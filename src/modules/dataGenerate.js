import { getData, keyword_range } from "../main.js";
import { updateConsoleLog } from "./domHelper.js";
import { currentYoutubeMode } from "./uiHandler.js";

export async function generateSelectedChannels() {
  const keywordOptions = document.getElementById("keywordOptions");
  const platform = keywordOptions.value.slice(-2);

  const selected = await getData(`${platform}/selected.json`);
  const keywords = await getData(`${platform}/keywords.json`);

  updateConsoleLog("generating selected channel csv");
  const selectedCsvContent =
    "Name,Link,Matched Video,Subscribers,12 videos Average View,Matched keywords,Description\n" +
    Object.entries(selected.selectedChannels)
      .map(([userName, channel]) => {
        return `${channel.name},${channel.channelUrl},${channel.matchedVideo},${
          channel.subscribers
        },${channel.averageViews},${channel.keywordList.join(" | ")},${
          channel.description
        }`;
      })
      .join("\n");

  generateAndDownloadSelectedcsv(
    selectedCsvContent,
    `selected_channels_${platform}_.csv`
  );

  let dataSelectedJsonContent = {
    selectedChannels: selected.selectedChannels,
  };

  if (platform === "yt") {
    updateConsoleLog("generating low average selected channel csv");
    const lowAverageCsvContent =
      "Name,Link,Matched Video,Subscribers,12 videos Average View,Matched keywords,Description\n" +
      Object.entries(selected.lowViewChannels)
        .map(([userName, channel]) => {
          return `${channel.name},${channel.channelUrl},${
            channel.matchedVideo
          },${channel.subscribers},${
            channel.averageViews
          },${channel.keywordList.join(" | ")},${channel.description}`;
        })
        .join("\n");

    generateAndDownloadSelectedcsv(
      lowAverageCsvContent,
      `low_average_selected_channels_${platform}_.csv`
    );

    dataSelectedJsonContent.lowViewChannels = selected.lowViewChannels;
  } else {
    const potential = await getData(`${platform}/potential.json`);
    dataSelectedJsonContent.extractedChannels = potential.extractedChannels;
  }

  updateConsoleLog("generating keyword match csv");
  const keywordMatch = generateKeywordMatchList(
    selected.selectedChannels,
    keywords[keywordOptions.value.slice(0, -3)]
  );

  const keywordMatchCSV = Object.entries(keywordMatch).map(
    ([keyword, keywordData]) => {
      return `${keyword},${keywordData.matched},${keywordData.choosed}`;
    }
  );

  generateAndDownloadCSV(
    keywordMatchCSV,
    `keyword_match_${platform}_.csv`,
    "Keywords,Matched Leads,Choosen Leads"
  );

  updateConsoleLog("generating data selected json");
  generateAndDownloadJSON(dataSelectedJsonContent, `data_selected_.json`);
}

export async function generateKeywordAndChannels() {
  updateConsoleLog("generating new channel sheet");
  const keywordOptions = document.getElementById("keywordOptions");
  const platform = keywordOptions.value.slice(-2);

  // const excluded_id =
  //   currentYoutubeMode.trim() === "shorts" && platform.trim() === "yt"
  //     ? "excluded_short"
  //     : "excluded";

  const existing = await getData(`${platform}/existing.json`);
  const keywords = await getData(`${platform}/keywords.json`);
  // const excluded = await getData(`${platform}/${excluded_id}.json`);
  const excluded = await getData(`${platform}/excluded.json`);

  let dataGeneratedJsonContent = {
    existingChannels: existing,
    excludedChannels: excluded,
    keywords: keywords.keywords,
  };

  updateConsoleLog("generating new existing channels csv");
  const accountUrl =
    platform === "yt"
      ? `https://www.youtube.com/@userName/${currentYoutubeMode}`
      : "https://www.tiktok.com/@userName";

  const existingChannelsData = Object.keys(existing).map((userName) =>
    accountUrl.replace("@userName", userName)
  );

  generateAndDownloadCSV(
    existingChannelsData,
    `existing_channels_${platform}.csv`,
    `existing_channels_${platform}`
  );

  updateConsoleLog("generating new excluded & excluded short channels csv");
  // const excludeNameCsv =
  //   currentYoutubeMode.trim() === "shorts"
  //     ? "excluded_channels_short"
  //     : "excluded_channels";

  const excludeChannelsData = Object.keys(excluded).map((userName) =>
    accountUrl.replace("@userName", userName)
  );

  generateAndDownloadCSV(
    excludeChannelsData,
    `excluded_channels_${platform}.csv`,
    `excluded_channels_${platform}`
  );

  if (platform === "yt") {
    const excludedShort = await getData(`${platform}/excluded_short.json`);

    const excludeChannelsShortData = Object.keys(excludedShort).map(
      (userName) => accountUrl.replace("@userName", userName)
    );

    generateAndDownloadCSV(
      excludeChannelsShortData,
      `excluded_channels_short_${platform}.csv`,
      `excluded_channels_short_${platform}`
    );

    dataGeneratedJsonContent.keywords_long = keywords.keywords_long;
    dataGeneratedJsonContent.keywords_short = keywords.keywords_short;
    dataGeneratedJsonContent.excludedChannelsShort = excludedShort;
  }

  updateConsoleLog("generating new keywords csv");
  const keywordsData = Object.keys(keywords[keywordOptions.value.slice(0, -3)]);

  generateAndDownloadCSV(
    keywordsData,
    `${keywordOptions.value}.csv`,
    `${keywordOptions.value}`
  );

  updateConsoleLog("generating data generated json");
  generateAndDownloadJSON(dataGeneratedJsonContent, `data_generated_.json`);
}

function generateKeywordMatchList(data, keywords) {
  let index = 1;
  const keywordsMatch = {};

  for (let keyword in keywords) {
    if (index >= keyword_range[0] && index <= keyword_range[1]) {
      keywordsMatch[keyword] = {
        matched: 0,
        choosed: 0,
      };
    }
    index += 1;
  }

  for (let [userName, channelData] of Object.entries(data)) {
    keywordsMatch[channelData.mostRecentVideo.keyword].choosed += 1;

    for (let index in channelData.keywordList) {
      keywordsMatch[channelData.keywordList[index]].matched += 1;
    }
  }

  const keywordSortedArray = Object.entries(keywordsMatch).sort(
    (a, b) => b[1].matched - a[1].matched
  );
  return Object.fromEntries(keywordSortedArray);
}

function generateAndDownloadJSON(data, filename) {
  const jsonContent =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));

  const link = document.createElement("a");
  link.setAttribute("href", jsonContent);
  link.setAttribute("download", filename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateAndDownloadCSV(data, filename, column) {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += `${column}\n`;

  for (let item of data) {
    csvContent += item.replace(/#/g, "") + "\n";
  }

  var encodedUri = encodeURI(csvContent);
  var link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateAndDownloadSelectedcsv(csvContent, fileName) {
  const encoder = new TextEncoder();
  const dataView = encoder.encode(csvContent);
  const blob = new Blob([dataView], { type: "text/csv" });

  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
