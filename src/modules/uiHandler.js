export let currentPlatform = "YouTube"; // YouTube or TikTok, default can be changed in the app
export let currentYoutubeMode = "videos"; // shorts or videos
let extractFinished = true;

import * as dataHandler from "./dataHandler.js";
import { updateConsoleLog } from "./domHelper.js";
import {
  getData,
  updateData,
  updateViewFetch,
  createSelectedYTChannel,
  createSelectedTTChannel,
  processPotentialTTChannels,
  keyword_range,
  searchFinished,
  viewFetchFinished,
  updateSearchFinished,
} from "../main.js";

export function toggleDarkMode() {
  const body = document.body;
  body.classList.toggle("dark-mode");
}

export function togglePlatform() {
  if (viewFetchFinished && searchFinished) {
    currentPlatform = currentPlatform === "YouTube" ? "TikTok" : "YouTube";
    updatePlatformUI();
    updateConsoleLog(`Switched current Platform to ${currentPlatform}`);
  } else {
    updateConsoleLog("Pls wait, Already a fetch job is runnnig....");
  }
}

export function toggleYoutubeMode() {
  if (viewFetchFinished && searchFinished) {
    currentYoutubeMode = currentYoutubeMode === "shorts" ? "videos" : "shorts";
    document.getElementById("youtubeModeToggle").textContent =
      currentYoutubeMode.charAt(0).toUpperCase() + currentYoutubeMode.slice(1);

    updateConsoleLog(`Switched to ${currentYoutubeMode} mode`);
  } else {
    updateConsoleLog("Pls wait, Already a fetch job is runnnig....");
  }
}

export async function updatePlatformUI() {
  if (viewFetchFinished && searchFinished) {
    const platform = document.getElementById("keywordOptions").value.slice(-2);
    const keywords = await getData(`${platform}/keywords.json`);

    const platformToggleButton = document.getElementById("platformToggle");
    platformToggleButton.textContent = currentPlatform;

    const keywordSelect = document.getElementById("keywordOptions");
    keywordSelect.innerHTML = "";

    if (currentPlatform === "YouTube") {
      keywordSelect.innerHTML = `
        <option value="keywords_yt" selected>Keyword yt</option>
        <option value="keywords_long_yt">Keyword Long yt</option>
        <option value="keywords_short_yt">Keyword Short yt</option>
      `;

      document.getElementById("extractTTVideos").style.display = "none";
      document.getElementById("processTTChannels").style.display = "none";
      document.getElementById("youtubeModeToggle").style.display = "inline";
    } else if (currentPlatform === "TikTok") {
      keywordSelect.innerHTML = `
        <option value="keywords_tt" selected>Keyword tt</option>
      `;

      document.getElementById("extractTTVideos").style.display = "inline";
      document.getElementById("youtubeModeToggle").style.display = "none";
      document.getElementById("processTTChannels").style.display = "inline";
    }

    loadKeywords(keywords[keywordOptions.value.slice(0, -3)]);
    updatePotentialChannels();
    updateSelectedChannels();
  } else {
    updateConsoleLog("Pls wait, Already a fetch job is runnnig....");
  }
}

export function openChannels(query) {
  var popup = document.createElement("div");
  popup.className = "popup";
  popup.innerHTML = `
  <div class="popup-content">
  <h2>Enter the channel numbers to open</h2>
  <div>
    <input type="number" id="startChannel" placeholder="Start Channel" />
    <input type="number" id="endChannel" placeholder="End Channel" />
  </div>
  <div>
    <button id="openChannelsButton">Open</button>
    <button id="closeChannelsButton">close</button>
  </div>
</div>
  `;

  document.body.appendChild(popup);
  document.getElementById("startChannel").focus();

  var openChannelsButton = document.getElementById("openChannelsButton");
  var closeChannelsButton = document.getElementById("closeChannelsButton");
  closeChannelsButton.addEventListener("click", function () {
    document.body.removeChild(popup);
  });

  openChannelsButton.addEventListener("click", function () {
    var startChannel = parseInt(document.getElementById("startChannel").value);
    var endChannel = parseInt(document.getElementById("endChannel").value);

    var channels = document.querySelectorAll(query);

    channels.forEach(function (li, index) {
      var channel = li.querySelector("a");

      if (channel) {
        if (
          (isNaN(startChannel) || index + 1 >= startChannel) &&
          (isNaN(endChannel) || index + 1 <= endChannel)
        ) {
          channel.click();
        }
      }
    });

    document.body.removeChild(popup);
  });
}

export function toggleDivs(showPotential) {
  const potentialDiv = document.getElementById("potentialDiv");
  const selectedDiv = document.getElementById("selectedDiv");
  if (showPotential) {
    updatePotentialChannels();
    selectedDiv.style.display = "none";
    potentialDiv.style.display = "block";
    potentialDiv.style.display = "flex";
  } else {
    updateSelectedChannels();
    potentialDiv.style.display = "none";
    selectedDiv.style.display = "block";
    selectedDiv.style.display = "flex";
  }
  potentialDiv.offsetHeight;
  selectedDiv.offsetHeight;
}

export function loadKeywords(keywords) {
  let index = 1;
  const select = document.getElementById("keywordSelect");
  select.innerHTML = "";

  for (const keyword in keywords) {
    if (index >= keyword_range[0] && index <= keyword_range[1]) {
      let option = document.createElement("option");
      option.value = keyword;
      option.text = keyword !== "" ? `${index} -` : "";
      option.text += ` ${keyword}`;
      select.appendChild(option);
    }
    index += 1;
  }
}

export async function updateSelectedChannels() {
  const keywordOptions = document.getElementById("keywordOptions").value;
  const platform = keywordOptions.slice(-2);

  let selected = await getData(`${platform}/selected.json`);
  const channels = selected.selectedChannels;

  const selectedList = document.getElementById("selectedList");
  selectedList.innerHTML = "";
  let index = 1;

  for (let [userName, channel] of Object.entries(channels)) {
    let li = document.createElement("li");
    li.innerHTML = `<p>${index}</p><a title="${channel.description}" href="${channel.channelUrl}" target="_blank">${channel.name}</a><div>${channel.subscribers}k Subs,   ${channel.averageViews}k Avrg</div>`;

    li.innerHTML += `<a title="Title:   ${channel.mostRecentVideo.videoTitle}\n\nDescription:   ${channel.mostRecentVideo.videoDescription}\n\nPublished:   ${channel.publishedAt}" href="${channel.mostRecentVideo.videoUrl}" target="_blank">${channel.mostRecentVideo.keyword}</a>`;

    let removeButton = document.createElement("button");
    removeButton.textContent = "-";
    removeButton.onclick = async (e) => {
      delete selected.selectedChannels[userName];
      await updateData(selected, `${platform}/selected.json`);

      e.target.closest("li").remove();
      dataHandler.updateChannelCount();
      updateConsoleLog(`${channel.name} removed from selected channels`);
    };

    let buttons = document.createElement("div");
    // Append everything to the list item
    buttons.appendChild(removeButton);
    li.appendChild(buttons);

    // Append the list item to the selected list
    selectedList.appendChild(li);
    index += 1;
  }

  dataHandler.updateChannelCount();
}

export async function updatePotentialChannels() {
  const keywordOptions = document.getElementById("keywordOptions").value;
  const platform = keywordOptions.slice(-2);

  let potential = await getData(`${platform}/potential.json`);
  let selected = await getData(`${platform}/selected.json`);

  const channels = potential.potentialChannels;
  const potentialList = document.getElementById("potentialList");

  potentialList.innerHTML = "";
  let index = 1;

  for (let [userName, channel] of Object.entries(channels)) {
    let li = document.createElement("li");
    let accountUrl =
      platform === "yt"
        ? `https://www.youtube.com/${userName}/${currentYoutubeMode}`
        : `https://www.tiktok.com/${userName}`;

    li.innerHTML = `<p>${index}</p><a title="${channel.description}" href="${accountUrl}" target="_blank">${channel.title}</a><div>${channel.subscribers}</div>`;

    if (userName in selected.selectedChannels) {
      li.innerHTML += "<p>sl</p>";
    } else if (platform === "yt" && userName in selected.lowViewChannels) {
      li.innerHTML += "<p>lsl</p>";
    } else {
      li.innerHTML += "<p></p>";
    }

    // Create a div to hold video details
    let videoDetailsDiv = document.createElement("div");
    videoDetailsDiv.style.display = "none"; // Start hidden

    // Populate the div with video links
    channel.videos.forEach((video) => {
      let videoLink = document.createElement("a");
      videoLink.href = video.videoUrl;
      videoLink.title = `Title:   ${video.videoTitle}\n\nDescription:   ${video.videoDescription}\n\nPublished:   ${video.publishedAt}`;
      videoLink.textContent = video.keyword;
      videoLink.target = "_blank";
      videoDetailsDiv.appendChild(videoLink);
      videoDetailsDiv.innerHTML += "<br>"; // New line for each video
    });

    // Toggle visibility function
    li.onclick = function () {
      videoDetailsDiv.style.display =
        videoDetailsDiv.style.display === "none" ? "block" : "none";
    };

    // Append video details div to the list item
    li.appendChild(videoDetailsDiv);

    // Create + and - buttons
    let addButton = document.createElement("button");
    addButton.textContent = "+";
    addButton.onclick = async (e) => {
      if (viewFetchFinished && searchFinished) {
        const selectedChannelData =
          platform === "yt"
            ? await createSelectedYTChannel(userName)
            : await createSelectedTTChannel(userName);

        if (selectedChannelData !== null) {
          let minimum_average_views;

          if (platform === "yt") {
            minimum_average_views =
              currentYoutubeMode.trim() === "videos" ? 4.9 : 9.9;
          }

          if (
            minimum_average_views &&
            parseFloat(selectedChannelData.averageViews) <=
              minimum_average_views
          ) {
            selected.lowViewChannels[userName] = selectedChannelData;

            updateConsoleLog(
              `${platform} in '${userName}' Doesnt have more then ${minimum_average_views}K views. Views: ${selectedChannelData.averageViews}`,
            );
            console.log(
              `${platform} in '${userName}' Doesnt have more then ${minimum_average_views}K views. Views: ${selectedChannelData.averageViews}`,
            );
          } else {
            selected.selectedChannels[userName] = selectedChannelData;

            updateConsoleLog(
              `${channel.title} added to ${platform} selected channels`,
            );
          }
        } else {
          updateConsoleLog(
            `${channel.title} Doesnt provide ${platform} selected data`,
          );
        }

        delete potential.potentialChannels[userName];

        await updateData(potential, `${platform}/potential.json`);
        await updateData(selected, `${platform}/selected.json`);

        dataHandler.updateChannelCount();

        e.target.closest("li").remove();
        updateViewFetch(true);
      } else {
        updateConsoleLog("Pls wait, Already a fetch job is runnnig....");
      }
    };

    let removeButton = document.createElement("button");
    removeButton.textContent = "-";
    removeButton.onclick = async (e) => {
      delete potential.potentialChannels[userName];

      await updateData(potential, `${platform}/potential.json`);

      dataHandler.updateChannelCount();
      e.target.closest("li").remove();
      updateConsoleLog(`${channel.title} removed from potential channels`);
    };

    let buttons = document.createElement("div");
    // Append everything to the list item
    buttons.appendChild(addButton);
    buttons.appendChild(removeButton);

    li.appendChild(buttons);

    // Append the list item to the potential list
    index += 1;
    potentialList.appendChild(li);
  }

  dataHandler.updateChannelCount();
}

export async function extractTTVideos() {
  if (extractFinished) {
    extractFinished = false;
    const keywordOptions = document.getElementById("keywordOptions").value;
    const selectedKeyword = document.getElementById("keywordSelect").value;

    updateConsoleLog("Extracting TT Videos...");
    let keywords = await getData(`tt/keywords.json`);
    let potential = await getData(`tt/potential.json`);

    let nextPageToken = keywords[keywordOptions.slice(0, -3)][selectedKeyword];

    nextPageToken = nextPageToken === "" ? 0 : parseInt(nextPageToken);

    const extractedTTData = { extractedChannels: potential.extractedChannels };

    try {
      const response = await fetch("/extract-tt-videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nextPageToken,
          extractedTTData,
        }),
      });

      if (!response.ok) {
        updateConsoleLog("Error:  Check Console...");
        console.error("Error extracting Data for tiktok..");
      } else {
        if (response.status === 414) {
          updateSearchFinished(true);
          updateConsoleLog(
            "Unfortunately the driver has been closed for some reason...",
          );
        } else {
          const responseJson = await response.json();
          const responseData = JSON.parse(responseJson);

          keywords[keywordOptions.slice(0, -3)][selectedKeyword] =
            responseData.nextPageToken;
          for (let [userName, extractedChannel] of Object.entries(
            responseData.data.extractedChannels,
          )) {
            let newChannel = extractedChannel;
            newChannel["keyword"] = selectedKeyword;

            potential.extractedChannels[userName] = newChannel;
          }

          await updateData(keywords, `tt/keywords.json`);
          await updateData(potential, `tt/potential.json`);
          await dataHandler.updateChannelCount();

          updateConsoleLog(
            "Succusfully Extracted the channels.. perform processing..",
          );
        }
      }
    } catch (error) {
      updateConsoleLog("Error:  Check Console...");
      console.error("Error sending data:", error);
    }
    extractFinished = true;
  } else {
    updateConsoleLog("Extract Job not finished yet Pls wait.......");
  }
}

export async function processTTChannels() {
  if (extractFinished) {
    try {
      const response = await fetch("/close-tt-search");

      if (response.ok) {
        updateSearchFinished(true);
        updateConsoleLog("Browser sucessfully closed...");

        const potential = await getData(`tt/potential.json`);

        if (Object.keys(potential.extractedChannels).length === 0) {
          updateConsoleLog("Theres No extracted tt Channels to process em....");
        } else {
          processPotentialTTChannels(potential.extractedChannels);
        }
      } else {
        updateConsoleLog("Error: check console...");
        console.error("Some internal error Closing Browser.....");
      }
    } catch (error) {
      console.error("Error sending reqeust to close browser: ", error);
      updateConsoleLog("Error: check console..");
    }
  } else {
    updateConsoleLog("Extract Job not finished yet Pls wait.......");
  }
}
