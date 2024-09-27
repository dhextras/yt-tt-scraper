import { updateConsoleLog } from "./domHelper.js";
import {
  currentYoutubeMode,
  updatePotentialChannels,
  updateSelectedChannels,
} from "./uiHandler.js";
import {
  getData,
  updateData,
  searchFinished,
  viewFetchFinished,
} from "../main.js";

async function addToExisting() {
  const keywordOptions = document.getElementById("keywordOptions").value;
  const platform = keywordOptions.slice(-2);

  let existing = await getData(`${platform}/existing.json`);
  let selected = await getData(`${platform}/selected.json`);

  for (let userName in selected.selectedChannels) {
    existing[userName] = "";
    delete selected.selectedChannels[userName];

    updateConsoleLog(`Added ${userName} to existing ${platform} channels..`);
  }

  if (platform === "yt") {
    for (let userName in selected.lowViewChannels) {
      existing[userName] = "";
      delete selected.lowViewChannels[userName];

      updateConsoleLog(
        `Added ${userName} (low_view) to existing ${platform} channels..`
      );
    }
  }

  await updateData(existing, `${platform}/existing.json`);
  await updateData(selected, `${platform}/selected.json`);
  updateSelectedChannels();
}

async function excludeChannels() {
  const keywordOptions = document.getElementById("keywordOptions").value;
  const platform = keywordOptions.slice(-2);
  const yt_shorts = platform.trim() === "yt";
  let excluded_shorts;

  if (yt_shorts) {
    excluded_shorts = await getData(`${platform}/excluded_short.json`);
  }
  const excluded_id =
    currentYoutubeMode.trim() === "shorts" && platform.trim() === "yt"
      ? "excluded_short"
      : "excluded";

  let excluded = await getData(`${platform}/${excluded_id}.json`);
  let potential = await getData(`${platform}/potential.json`);

  if (searchFinished && viewFetchFinished) {
    const confirm = window.confirm(
      "Are you sure you want to exclude channels?"
    );

    if (confirm) {
      for (let userName in potential.potentialChannels) {
        excluded[userName] = "";
        if (yt_shorts) {
          excluded_shorts[userName] = "";
        }
        delete potential.potentialChannels[userName];
      }

      if (yt_shorts) {
        await updateData(excluded_shorts, `${platform}/excluded_short.json`);
      }
      await updateData(excluded, `${platform}/${excluded_id}.json`);
      await updateData(potential, `${platform}/potential.json`);
      updatePotentialChannels();
    }
  } else {
    updateConsoleLog("Fetch job is already running pls wait.. ");
  }
}

async function updateChannelCount() {
  const keywordOptions = document.getElementById("keywordOptions").value;
  const platform = keywordOptions.slice(-2);

  const potential = await getData(`${platform}/potential.json`);
  const selected = await getData(`${platform}/selected.json`);

  let potentialCount = Object.keys(potential.potentialChannels).length;
  let selectedCount = Object.keys(selected.selectedChannels).length;
  let channelCountText = "";

  if (platform === "tt") {
    let extractedCount = Object.keys(potential.extractedChannels).length;
    channelCountText = `Extracted: ${extractedCount}, `;
  }
  document.getElementById("channelNumber").textContent =
    channelCountText +
    `Potential: ${potentialCount}, Selected: ${selectedCount}`;
}

async function updateQuotaCount(unit) {
  let quota = await getApi();

  if (quota !== null) {
    quota.apis[quota.current_api_index].quotaCount += parseInt(unit);
    await updateData(quota, "yt/quota.json");
    document.getElementById("quotaNumber").textContent = `Quota Used: ${
      quota.apis[quota.current_api_index].quotaCount
    }`;
  }
  return quota;
}

async function getApi() {
  let quota = await getData("yt/quota.json");

  if (quota.current_api_index + 1 > quota.apis.length) {
    return null;
  }

  if (quota.apis[quota.current_api_index].quotaCount >= 9800) {
    quota.current_api_index += 1;
  }

  return quota;
}

export {
  addToExisting,
  excludeChannels,
  updateChannelCount,
  updateQuotaCount,
  getApi,
};
