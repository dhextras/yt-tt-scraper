let searchFinished = true;
let viewFetchFinished = true;

let keyword_range = [0, 1000];
let API_KEY;

import * as uiHandler from "./modules/uiHandler.js";
import * as dataHandler from "./modules/dataHandler.js";
import * as dataGenerate from "./modules/dataGenerate.js";
import { updateConsoleLog } from "./modules/domHelper.js";

window.toggleDivs = uiHandler.toggleDivs;
window.openChannels = uiHandler.openChannels;
window.toggleDarkMode = uiHandler.toggleDarkMode;
window.togglePlatform = uiHandler.togglePlatform;
window.extractTTVideos = uiHandler.extractTTVideos;
window.processTTChannels = uiHandler.processTTChannels;
window.toggleYoutubeMode = uiHandler.toggleYoutubeMode;

window.addToExisting = dataHandler.addToExisting;
window.excludeChannels = dataHandler.excludeChannels;

window.generateSelectedChannels = dataGenerate.generateSelectedChannels;
window.generateKeywordAndChannels = dataGenerate.generateKeywordAndChannels;

// Function to load keywords and initialize the page
async function initializePage() {
  const keywordOptions = document.getElementById("keywordOptions");
  const platform = keywordOptions.value.slice(-2);

  uiHandler.toggleDivs(true);
  uiHandler.toggleDarkMode();
  uiHandler.updatePlatformUI();

  document.getElementById("youtubeModeToggle").textContent =
    uiHandler.currentYoutubeMode.charAt(0).toUpperCase() +
    uiHandler.currentYoutubeMode.slice(1);

  await initiateDataFetch();
  const keywords = await getData(`${platform}/keywords.json`);

  uiHandler.loadKeywords(keywords[keywordOptions.value.slice(0, -3)]);

  const quota = await dataHandler.updateQuotaCount(0);
  API_KEY = quota === null ? null : quota.apis[quota.current_api_index].key;

  document
    .getElementById("searchButton")
    .addEventListener("click", handleSearch);

  keywordOptions.addEventListener("change", async (event) => {
    const keywordType = event.target.value;
    const platform = keywordType.slice(-2);

    const keywords = await getData(`${platform}/keywords.json`);

    uiHandler.loadKeywords(keywords[keywordType.slice(0, -3)]);
  });
}

// dataHandler.js

// Function to get data from the server and update a global variable
async function getData(fileName) {
  try {
    const response = await fetch(`/data?fileName=${fileName}`);
    const data = await response.json();

    return data;
  } catch (error) {
    updateConsoleLog("Error:  Check Console...");
    console.error("Error fetching data:", error);
    return null;
  }
}

async function updateData(newData, fileName) {
  try {
    const response = await fetch("/update-data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: newData, fileName }),
    });

    if (!response.ok) {
      updateConsoleLog("Error:  Check Console...");
      console.error("Error updating data on the server");
    }
  } catch (error) {
    updateConsoleLog("Error:  Check Console...");
    console.error("Error sending data:", error);
  }
}

async function initiateDataFetch() {
  // Update the searchFinished state and UI
  updateConsoleLog("Fetching keywords and channels......");
  searchFinished = false;

  try {
    // Making a GET request to the server to initiate data fetching and processing
    const response = await fetch("/fetch-process-data");

    if (response.ok) {
      // Once the process is finished, update the searchFinished state and UI
      updateConsoleLog("Data fetch and processing complete.");
    } else {
      updateConsoleLog("Data fetched failed check console....");
    }
  } catch (error) {
    console.error("Error initiating data fetch:", error);
  }

  searchFinished = true;
}

// logicHandler.js

async function processPotentialYTChannels(items, keyword) {
  // const excluded_id =
  //   uiHandler.currentYoutubeMode.trim() === "shorts"
  //     ? "excluded_short"
  //     : "excluded";

  let potentialYT = await getData(`yt/potential.json`);

  const existingYT = await getData(`yt/existing.json`);
  const excludedYT = await getData(`yt/excluded.json`);
  const excludedShortsYT = await getData(`yt/excluded_short.json`);
  // const excludedYT = await getData(`yt/${excluded_id}.json`);

  for (let item of items) {
    let channelId = item.snippet.channelId;

    const channelData = await fetchYTChannelData(channelId, item.snippet);
    let channelUsername =
      channelData === null ? null : channelData.snippet.customUrl;

    if (channelUsername) {
      channelUsername = channelUsername.includes("@")
        ? channelUsername
        : `user/${channelUsername}`;
    }
    const subscribers =
      channelData === null ? null : channelData.statistics.subscriberCount;

    if (
      channelUsername &&
      subscribers > 5000 &&
      !(channelUsername in excludedYT) &&
      !(channelUsername in existingYT) &&
      !(channelUsername in excludedShortsYT)
    ) {
      const checkPotentialChannel = potentialYT.potentialChannels[
        channelUsername
      ]
        ? true
        : false;

      const videos = checkPotentialChannel
        ? potentialYT.potentialChannels[channelUsername]["videos"]
        : [];

      videos.push({
        keyword: keyword,
        publishedAt: item.snippet.publishedAt,
        videoTitle: item.snippet.title,
        videoDescription: item.snippet.description,
        videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      });

      let newChannelInfo = {
        channelId: channelId,
        subscribers: subscribers,
        title: channelData.snippet.title,
        description: channelData.snippet.description,
        videos: videos,
      };

      potentialYT.potentialChannels[channelUsername] = newChannelInfo;
      await updateData(potentialYT, "yt/potential.json");

      uiHandler.updatePotentialChannels();
    }
  }

  const quota = await dataHandler.updateQuotaCount(items.length);
  API_KEY = quota.apis[quota.current_api_index].key;
  searchFinished = true;
}

async function processPotentialTTChannels(items) {
  let excludedTT = await getData(`tt/excluded.json`);
  let potentialTT = await getData(`tt/potential.json`);

  const existingTT = await getData(`tt/existing.json`);

  for (let [channelUsername, item] of Object.entries(items)) {
    if (
      channelUsername &&
      !(channelUsername in existingTT) &&
      !(channelUsername in excludedTT)
    ) {
      updateConsoleLog(`Processing ${channelUsername}'s TT channel....`);

      const channelData =
        await fetchTTChannelDataAndAverageView(channelUsername);

      if (channelUsername) {
        channelUsername = channelUsername.includes("@")
          ? channelUsername
          : `@${channelUsername}`;
      }

      const subscribers =
        channelData === null ? null : channelData.subscriberCount;

      if (subscribers >= 10000 && channelData.averageViews >= 30) {
        updateConsoleLog(`Found a Potential Channel.... ${channelUsername}`);
        const checkPotentialChannel = potentialTT.potentialChannels[
          channelUsername
        ]
          ? true
          : false;

        const videos = checkPotentialChannel
          ? potentialTT.potentialChannels[channelUsername]["videos"]
          : [];

        item.videos.forEach((video) => {
          videos.push({
            keyword: item.keyword,
            publishedAt: standardizeDate(video.publishedAt),
            videoTitle: "",
            videoDescription: video.videoDescription,
            videoUrl: video.videoUrl,
          });
        });

        let newChannelInfo = {
          subscribers: subscribers,
          title: channelData.title,
          description: channelData.description,
          averageViews: channelData.averageViews,
          videos: videos,
        };

        potentialTT.potentialChannels[channelUsername] = newChannelInfo;
        uiHandler.updatePotentialChannels();
      } else {
        excludedTT[channelUsername] = "";
        updateConsoleLog(
          `Sucuessfully Fetched Data for tt channel ${channelUsername}`,
        );
      }

      await updateData(excludedTT, "tt/excluded.json");
    }

    delete potentialTT.extractedChannels[channelUsername];
    updateConsoleLog(`Succusfully removed TT channel ${channelUsername}`);

    await updateData(potentialTT, "tt/potential.json");
    await dataHandler.updateChannelCount();
  }
  searchFinished = true;
}

async function createSelectedYTChannel(userName) {
  const selectedYT = await getData(`yt/selected.json`);
  const potentialYT = await getData(`yt/potential.json`);

  const channelData = potentialYT.potentialChannels[userName];
  const averageViews = await fetchYTAverageViews(channelData.channelId);

  let matchedVideo = "";
  let selectedChannel = selectedYT.selectedChannels[userName];
  let keywordList = selectedChannel ? selectedChannel.keywordList : [];

  let mostRecentVideo = null;
  for (let id in channelData.videos) {
    const video = channelData.videos[id];
    if (!keywordList.includes(video.keyword)) {
      keywordList.push(video.keyword);
    }

    if (
      !mostRecentVideo ||
      new Date(video.publishedAt) > new Date(mostRecentVideo.publishedAt)
    ) {
      mostRecentVideo = video;
    }
  }

  if (mostRecentVideo) {
    matchedVideo = mostRecentVideo.videoUrl;
  }

  const newChannelData = {
    name: channelData.title,
    channelUrl: `https://www.youtube.com/${userName}/${uiHandler.currentYoutubeMode}`,
    matchedVideo,
    subscribers: Math.round(channelData.subscribers / 100) / 10,
    averageViews,
    keywordList,
    description: channelData.description
      .replace(/(\r\n|\n|\r)/gm, "  ")
      .replace(/,/g, "."),
    mostRecentVideo,
    channelId: channelData.channelId,
    publishedAt: mostRecentVideo.publishedAt,
  };

  return newChannelData;
}

async function createSelectedTTChannel(userName) {
  const selectedTT = await getData(`tt/selected.json`);
  const potentialTT = await getData(`tt/potential.json`);

  const channelData = potentialTT.potentialChannels[userName];
  let matchedVideo = "";
  let selectedChannel = selectedTT.selectedChannels[userName];
  let keywordList = selectedChannel ? selectedChannel.keywordList : [];

  let mostRecentVideo = null;
  for (let id in channelData.videos) {
    const video = channelData.videos[id];
    if (!keywordList.includes(video.keyword)) {
      keywordList.push(video.keyword);
    }

    if (
      !mostRecentVideo ||
      new Date(video.publishedAt) > new Date(mostRecentVideo.publishedAt)
    ) {
      mostRecentVideo = video;
    }
  }

  if (mostRecentVideo) {
    matchedVideo = mostRecentVideo.videoUrl;
  }

  const newChannelData = {
    name: channelData.title,
    channelUrl: `https://www.tiktok.com/${userName}`,
    matchedVideo,
    subscribers: Math.round(channelData.subscribers / 100) / 10,
    averageViews: channelData.averageViews,
    keywordList,
    description: channelData.description
      .replace(/(\r\n|\n|\r)/gm, "  ")
      .replace(/,/g, "."),
    mostRecentVideo,
    channelId: channelData.channelId,
    publishedAt: mostRecentVideo.publishedAt,
  };

  return newChannelData;
}

async function fetchYTChannelData(channelId, snippet) {
  updateConsoleLog(`Fetching channel data for ${channelId}`);
  const API_URL = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${API_KEY}`;

  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      updateConsoleLog(
        `Sucusfully Fetched Data for ${data.items[0].snippet.customUrl}`,
      );
      return data.items[0];
    } else {
      updateConsoleLog("Error:  Check Console...");
      console.error("No channel data found for the given ID.");
      console.log(channelId, snippet, API_URL);
      return null;
    }
  } catch (error) {
    updateConsoleLog("Error:  Check Console...");
    console.error("Error fetching channel data:", error);
    console.log(channelId, snippet, API_URL);
    return null;
  }
}

async function fetchYTAverageViews(channelId) {
  viewFetchFinished = false;
  updateConsoleLog(`Fetching average views from id --> ${channelId}`);

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&order=date&part=snippet&type=video&maxResults=12&key=${API_KEY}&publishedBefore=${getDaysAgo(
      1,
    )}`,
  );

  const data = await response.json();
  let videoIdList = data.items.map((video) => video.id.videoId);
  const videoIdString = `${videoIdList.join(",")}`;

  let quota = await dataHandler.updateQuotaCount(100);
  API_KEY = quota.apis[quota.current_api_index].key;
  const videoResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIdString}&maxResults=12&key=${API_KEY}`,
  );
  const videoData = await videoResponse.json();

  let totalViews = 0;
  for (let item in videoData.items) {
    totalViews += parseInt(videoData.items[item].statistics.viewCount);
  }

  quota = await dataHandler.updateQuotaCount(1);
  API_KEY = quota.apis[quota.current_api_index].key;
  const averageViews = Math.round(totalViews / data.items.length / 100) / 10;

  return averageViews;
}

// need to update this data in this function which is for testing and fix errors
async function fetchTTChannelDataAndAverageView(userName) {
  updateConsoleLog(`Fetching channel data and average views for ${userName}`);

  searchFinished = false;

  try {
    const response = await fetch("/fetch-channel-and-average-view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userName }),
    });

    if (!response.ok) {
      updateConsoleLog("Error:  Check Console...");
      console.error("Error Opening tiktok search..");
    } else {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    updateConsoleLog("Error:  Check Console...");
    console.error("Error sending data:", error);
  }
}

// handlingSearch.js

async function handleSearch() {
  if (searchFinished && viewFetchFinished) {
    if (uiHandler.currentPlatform === "YouTube") {
      document.getElementById("stopYTSearch").style.display = "inline-block";
      document.getElementById("searchButton").style.display = "none";

      await startYTSearchLoop();
    } else if (uiHandler.currentPlatform === "TikTok") {
      await performTiktokSearch();
    }
  } else {
    updateConsoleLog("Last Search was not finished Yet...");
  }
}

async function startYTSearchLoop() {
  let stopSearchInterval = setInterval(async () => {
    if (searchFinished && viewFetchFinished) {
      await performYtSearch(stopSearchInterval);
    }
  }, 3000);

  document.getElementById("stopYTSearch").addEventListener("click", () => {
    stopYTSearchLoop(stopSearchInterval);
  });
}

function stopYTSearchLoop(stopSearchInterval) {
  clearInterval(stopSearchInterval);
  document.getElementById("stopYTSearch").style.display = "none";
  document.getElementById("searchButton").style.display = "inline-block";
}

async function performYtSearch(stopSearchInterval) {
  let quota = await dataHandler.getApi();

  if (quota === null) {
    updateConsoleLog(
      `You have exceeded the api key limit pls create new api or check it fucker...`,
    );
    console.log(
      `You have exceeded the api key limit pls create new api or check it fucker...`,
    );
    stopYTSearchLoop(stopSearchInterval);
    return;
  }

  let keywordsYT = await getData("yt/keywords.json");

  const keywordOptions = document.getElementById("keywordOptions").value;
  const selectedKeyword = document.getElementById("keywordSelect").value;

  const nextPageToken =
    keywordsYT[keywordOptions.slice(0, -3)][selectedKeyword];

  updateConsoleLog(`Performing Youtube Search for ${selectedKeyword}..`);
  searchFinished = false;

  // Update the API URL to include the nextPageToken if present
  const API_URL = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&q=${encodeURIComponent(
    selectedKeyword,
  )}&pageToken=${nextPageToken}&key=${API_KEY}&order=relevance&relevanceLanguage=en&publishedAfter=${getMonthsAgo(
    8,
  )}`;

  fetch(API_URL)
    .then((response) => response.json())
    .then(async (data) => {
      const quota = await dataHandler.updateQuotaCount(100);
      API_KEY = quota.apis[quota.current_api_index].key;
      // Update the nextPageToken in the state
      keywordsYT[keywordOptions.slice(0, -3)][selectedKeyword] =
        data.nextPageToken ? data.nextPageToken : data.prevPageToken;

      await updateData(keywordsYT, "yt/keywords.json");
      processPotentialYTChannels(data.items, selectedKeyword);
    })
    .catch((error) => {
      updateConsoleLog("Error:  Check Console...");
      console.error("Error:", error);
    });
}

async function performTiktokSearch() {
  const selectedKeyword = document.getElementById("keywordSelect").value;

  updateConsoleLog(`Performing Tiktok Search for ${selectedKeyword}..`);
  searchFinished = false;

  const searchURL = `https://www.tiktok.com/search/video?q=${encodeURIComponent(
    selectedKeyword,
  )}`;

  try {
    const response = await fetch("/open-tiktok-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ searchURL }),
    });

    if (!response.ok) {
      updateConsoleLog("Error:  Check Console...");
      console.error("Error Opening tiktok search..");
    }
  } catch (error) {
    updateConsoleLog("Error:  Check Console...");
    console.error("Error sending data:", error);
  }
}

// boilerplate codes

function getDaysAgo(day) {
  const date = new Date();
  date.setDate(date.getDate() - day);
  return date.toISOString();
}

function getMonthsAgo(month) {
  const date = new Date();
  date.setMonth(date.getMonth() - month);
  return date.toISOString();
}

function standardizeDate(dateString) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  let standardizedDate;

  // Check for full date format 'YYYY-MM-DD' or 'YYYY-M-D'
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString)) {
    standardizedDate = new Date(dateString);
  }
  // Check for date without year 'M-D'
  else if (/^\d{1,2}-\d{1,2}$/.test(dateString)) {
    standardizedDate = new Date(`${currentYear}-${dateString}`);
  }
  // Check for relative time strings like '10d ago', '19h ago', '2w ago'
  else if (/^(\d+)(d|h|w) ago$/.test(dateString)) {
    const match = dateString.match(/^(\d+)(d|h|w) ago$/);
    const number = parseInt(match[1], 10);
    const type = match[2];

    switch (type) {
      case "d":
        standardizedDate = new Date(
          currentDate.getTime() - number * 24 * 60 * 60 * 1000,
        );
        break;
      case "h":
        standardizedDate = new Date(
          currentDate.getTime() - number * 60 * 60 * 1000,
        );
        break;
      case "w":
        standardizedDate = new Date(
          currentDate.getTime() - number * 7 * 24 * 60 * 60 * 1000,
        );
        break;
      default:
        standardizedDate = currentDate;
        break;
    }
  }
  // If format not recognized, set to current date
  else {
    standardizedDate = currentDate;
  }

  // Return date in 'YYYY-MM-DD' format
  return standardizedDate.toISOString().split("T")[0];
}

function updateViewFetch(state) {
  viewFetchFinished = state;
}

function updateSearchFinished(state) {
  searchFinished = state;
}

export {
  getData,
  updateData,
  updateViewFetch,
  updateSearchFinished,
  createSelectedYTChannel,
  createSelectedTTChannel,
  processPotentialTTChannels,
  keyword_range,
  searchFinished,
  viewFetchFinished,
};

initializePage();
