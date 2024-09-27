const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;
const path = require("path");
const app = express();
const bodyParser = require("body-parser");
const port = 3000;
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

let driver;

const url =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSCUKm1R460-jaWLcDx_cVMjBCKu_v5kfuSzBvbOjeW9Gn3I623GkwSlLquOoJodJC_Exn_JPl5aFTi/pubhtml";

app.use(bodyParser.json({ limit: "100mb" })); // Middleware to parse JSON bodies
app.use(express.static(path.join(__dirname))); // Serve static files from the root directory

// Function To read Data from the json files
async function readJson(fileName) {
  const data = await fs.readFile(`data/${fileName}`, "utf8");
  return JSON.parse(data);
}

// Function To update Data to the respective files
async function updateJson(data, fileName) {
  await fs.writeFile(`data/${fileName}`, JSON.stringify(data, null, 2));
}

// Function to extract the unique part of YouTube URLs
function extractUniqueYouTubeId(urls) {
  return urls
    .map((url) => {
      // This regex will match @username, user/username, and channel/CHANNEL_ID
      const matches = url.match(
        /https:\/\/www\.youtube\.com\/(@[^/]+|user\/[^/]+|channel\/[^/]+)\/(videos|shorts)/
      );
      return matches ? matches[1] : null;
    })
    .filter(Boolean); // Filter out any null values
}

// Function to extract the unique part of tiktok URLs
function extractUniqueTikTokId(urls) {
  return urls
    .map((url) => {
      // This regex will match @username, user/username, and channel/CHANNEL_ID
      const matches = url.match(/https:\/\/www\.tiktok\.com\/(@[^\/]+)/);
      return matches ? matches[1] : null;
    })
    .filter(Boolean); // Filter out any null values
}

function extractData($, selector) {
  const data = [];
  $(selector).each((i, el) => {
    // Check if the element is a link and extract the href attribute
    const link = $(el).find("a").attr("href");
    const text = $(el).text().trim();
    data.push(link || text);
  });
  return data;
}

// Main function to fetch and process the data
async function fetchDataAndProcess() {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const viewportDivs = $("#sheets-viewport > div");

    // Initialize an object to hold our data
    const sheetData = {
      yt: {
        keywords: [],
        keywords_long: [],
        keywords_short: [],
        existing_channels: [],
        excluded_channels: [],
        excluded_channels_short: [],
      },
      tt: {
        keywords: [],
        existing_channels: [],
        excluded_channels: [],
      },
    };

    // Iterate over the viewport divs and extract data
    viewportDivs.each((i, div) => {
      const divId = $(div).attr("id");
      const rows = $(div).find(".waffle > tbody > tr");
      const dataType = rows.eq(0).find("td").text().trim().toLowerCase();
      const dataTypeId = dataType.slice(0, -3);
      const currentPlatform = dataType.slice(-2);

      if (dataType.includes("keywords")) {
        sheetData[currentPlatform][dataTypeId] = extractData(
          $,
          `#${divId} .waffle > tbody > tr:gt(0) > td`
        );
      } else if (dataType.includes("channels")) {
        const urls = extractData(
          $,
          `#${divId} .waffle > tbody > tr:gt(0) > td > a`
        );
        sheetData[currentPlatform][dataTypeId] =
          currentPlatform === "yt"
            ? extractUniqueYouTubeId(urls)
            : extractUniqueTikTokId(urls);
      }
    });
    await updateChannelAndKeyword(sheetData);
  } catch (error) {
    console.error("Error fetching or processing data:", error);
  }
}

async function updateChannelAndKeyword(newData) {
  try {
    let yt_keywords = await readJson("yt/keywords.json");
    let yt_existing = await readJson("yt/existing.json");
    let yt_excluded = await readJson("yt/excluded.json");
    let yt_excluded_short = await readJson("yt/excluded_short.json");

    let tt_keywords = await readJson("tt/keywords.json");
    let tt_existing = await readJson("tt/existing.json");
    let tt_excluded = await readJson("tt/excluded.json");

    // Merge yt newData into existingData & excludedData
    yt_existing = newData.yt.existing_channels.reduce((acc, channel) => {
      if (channel.includes("@")) {
        acc[channel.toLowerCase()] = "";
      } else {
        acc[channel] = "";
      }
      return acc;
    }, {});
    await updateJson(yt_existing, "yt/existing.json");

    yt_excluded = newData.yt.excluded_channels.reduce((acc, channel) => {
      if (channel.includes("@")) {
        acc[channel.toLowerCase()] = "";
      } else {
        acc[channel] = "";
      }
      return acc;
    }, yt_excluded || {});
    await updateJson(yt_excluded, "yt/excluded.json");

    yt_excluded_short = newData.yt.excluded_channels_short.reduce(
      (acc, channel) => {
        if (channel.includes("@")) {
          acc[channel.toLowerCase()] = "";
        } else {
          acc[channel] = "";
        }
        return acc;
      },
      yt_excluded_short || {}
    );
    await updateJson(yt_excluded_short, "yt/excluded_short.json");

    // Merge tt newData into existingData & excludedData
    tt_existing = newData.tt.existing_channels.reduce((acc, channel) => {
      acc[channel.toLowerCase()] = "";
      return acc;
    }, {});
    await updateJson(tt_existing, "tt/existing.json");

    tt_excluded = newData.tt.excluded_channels.reduce((acc, channel) => {
      acc[channel.toLowerCase()] = "";
      return acc;
    }, tt_excluded || {});
    await updateJson(tt_excluded, "tt/excluded.json");

    // Update yt keywords with new ones, but don't replace existing ones
    newData.yt.keywords.forEach((keyword) => {
      if (!yt_keywords.keywords.hasOwnProperty(keyword)) {
        yt_keywords.keywords[keyword] = "";
      }
    });

    // Remove old yt keywords not present in the new data
    Object.keys(yt_keywords.keywords).forEach((keyword) => {
      if (!newData.yt.keywords.includes(keyword)) {
        delete yt_keywords.keywords[keyword];
      }
    });

    // Update yt keywords_long with new ones, but don't replace existing ones
    newData.yt.keywords_long.forEach((keyword) => {
      if (!yt_keywords.keywords_long.hasOwnProperty(keyword)) {
        yt_keywords.keywords_long[keyword] = "";
      }
    });

    // Remove old yt keywords_long not present in the new data
    Object.keys(yt_keywords.keywords_long).forEach((keyword) => {
      if (!newData.yt.keywords_long.includes(keyword)) {
        delete yt_keywords.keywords_long[keyword];
      }
    });

    // Update yt keywords_short with new ones, but don't replace existing ones
    newData.yt.keywords_short.forEach((keyword) => {
      if (!yt_keywords.keywords_short.hasOwnProperty(keyword)) {
        yt_keywords.keywords_short[keyword] = "";
      }
    });

    // Remove old yt keywords_short not present in the new data
    Object.keys(yt_keywords.keywords_short).forEach((keyword) => {
      if (!newData.yt.keywords_short.includes(keyword)) {
        delete yt_keywords.keywords_short[keyword];
      }
    });

    // Update yt Keywords to the file
    await updateJson(yt_keywords, "yt/keywords.json");

    // Update tt keywords with new ones, but don't replace existing ones
    newData.tt.keywords.forEach((keyword) => {
      if (!tt_keywords.keywords.hasOwnProperty(keyword)) {
        tt_keywords.keywords[keyword] = "";
      }
    });

    // Remove old tt keywords not present in the new data
    Object.keys(tt_keywords.keywords).forEach((keyword) => {
      if (!newData.tt.keywords.includes(keyword)) {
        delete tt_keywords.keywords[keyword];
      }
    });

    // Update tt Keywords to the file
    await updateJson(tt_keywords, "tt/keywords.json");
  } catch (error) {
    console.error("Error reading existing data: ", error);
  }
}

// Open tiktok search
async function openTikTokSearch(url) {
  let userDataPath =
    "C:\\Users\\Asus\\AppData\\Local\\Google\\Chrome\\User Data";
  // let userDataPath =
  // "C:\\Users\\KEAX\\AppData\\Local\\Google\\Chrome\\User Data";

  let options = new chrome.Options();
  // Adding the user data path to Chrome options
  options.addArguments(`user-data-dir=${userDataPath}`);
  options.addArguments("profile-directory=Profile 1");

  let driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  await driver.get(url);

  return driver;
}

async function extractTTVideos(nextPageToken, data) {
  try {
    const videos = await driver.findElements(
      By.css(".css-1soki6-DivItemContainerForSearch")
    );

    for (let i = nextPageToken; i < videos.length; i++) {
      const video = videos[i];
      const videoLink = await video
        .findElement(By.css("a[href^='https://www.tiktok.com/@']"))
        .getAttribute("href");
      const userLink = await video
        .findElement(By.css("a[data-e2e='search-card-user-link']"))
        .getAttribute("href");
      const description = await video
        .findElement(By.css(".css-f22ew5-DivMetaCaptionLine"))
        .getText();
      const postedDate = await video
        .findElement(By.css(".css-dennn6-DivTimeTag"))
        .getText();

      const username = userLink.split("@")[1].split("/")[0];

      if (!data.extractedChannels[`@${username}`]) {
        data.extractedChannels[`@${username}`] = {
          videos: [],
        };
      }

      data.extractedChannels[`@${username}`].videos.push({
        videoUrl: videoLink,
        videoDescription: description,
        publishedAt: postedDate,
      });

      nextPageToken += 1;
    }

    return { nextPageToken, data };
  } catch (error) {
    return null;
  }
}

// Function to extract channel information
async function extractChannelInfo(channelDriver) {
  await channelDriver.wait(
    until.elementLocated(By.css(".css-10pb43i-H2ShareSubTitle"))
  );
  const title = await channelDriver
    .findElement(By.css(".css-10pb43i-H2ShareSubTitle"))
    .getText();
  const description = await channelDriver
    .findElement(By.css(".css-4ac4gk-H2ShareDesc"))
    .getText();
  const subscriberCount = await channelDriver
    .findElement(By.css("strong[data-e2e='followers-count']"))
    .getText();

  return {
    title,
    description,
    subscriberCount: await parseSubsAndViews(subscriberCount.toLowerCase()),
  };
}

async function parseSubsAndViews(inputStr) {
  if (inputStr.includes("k")) {
    return parseInt(parseFloat(inputStr.replace("k", "")) * 1000);
  } else if (inputStr.includes("m")) {
    return parseInt(parseFloat(inputStr.replace("m", "")) * 1000000);
  } else if (inputStr.includes("b")) {
    return parseInt(parseFloat(inputStr.replace("b", "")) * 1000000000);
  } else {
    return parseInt(parseFloat(inputStr));
  }
}

// Function to extract the top 12 videos excluding pinned ones
async function extractTop12Videos(channelDriver) {
  let pinnedNo = 0;
  await channelDriver.wait(
    until.elementLocated(By.css(".css-1as5cen-DivWrapper"))
  );

  const videoElements = await channelDriver.findElements(
    By.css(".css-1as5cen-DivWrapper")
  );

  for (let [id, videoElement] of Object.entries(videoElements)) {
    const pinnedVideos = await videoElement.findElements(
      By.css(".css-3on00d-DivBadge")
    );

    if (pinnedVideos.length === 1) {
      pinnedNo += 1;
    }
  }

  const top12Videos = videoElements.slice(pinnedNo, pinnedNo + 12);

  return top12Videos;
}

// Function to calculate the average views of the top 12 videos
async function calculateAverageViews(top12Videos, channelDriver) {
  await channelDriver.wait(
    until.elementLocated(By.css(".css-dirst9-StrongVideoCount"))
  );
  let totalView = 0;
  const totalViews = await top12Videos.reduce(async (sum, video) => {
    const viewsText = await video
      .findElement(By.css(".css-dirst9-StrongVideoCount"))
      .getText();
    const views = await parseSubsAndViews(viewsText.toLowerCase());

    totalView += parseInt(views);
  }, 0);

  return Math.round(totalView / top12Videos.length / 100) / 10;
}

// Endpoint to get the data
app.get("/data", async (req, res) => {
  try {
    const data = await readJson(req.query.fileName);
    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Error reading data");
  }
});

// Endpoint to update the data
app.post("/update-data", async (req, res) => {
  try {
    await updateJson(req.body.data, req.body.fileName);
    res.send("Data updated successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error writing data");
  }
});

// Endpoint to fetching and processing data
app.get("/fetch-process-data", async (req, res) => {
  try {
    await fetchDataAndProcess();
    res.send("Data fetching and processing initiated.");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error during data fetching and processing: " + error);
  }
});

// Endpoints For tiktok scraping
app.post("/open-tiktok-search", async (req, res) => {
  try {
    driver = await openTikTokSearch(req.body.searchURL);
    res.send("Tiktok Search Opened Sucussfully.");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error while Opening Search for Tiktok...");
  }
});

app.post("/extract-tt-videos", async (req, res) => {
  try {
    //driver = await openTikTokSearch(req.body.searchURL)
    const data = await extractTTVideos(
      req.body.nextPageToken,
      req.body.extractedTTData
    );
    if (data !== null) {
      res.json(JSON.stringify(data));
    } else {
      res.status(414).send("The driver has been closed");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Error while extracting channels for Tiktok...");
  }
});

app.get("/close-tt-search", async (req, res) => {
  try {
    if (driver) {
      await driver.quit();
    }

    driver = null;
    res.send("The driver has been succusfull closed.");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error while closing the browser....");
  }
});

app.post("/fetch-channel-and-average-view", async (req, res) => {
  try {
    // Open TikTok channel for the provided username
    const channelUrl = `https://www.tiktok.com/${req.body.userName}`;
    let channelDriver = await openTikTokSearch(channelUrl);

    // Extract channel information and video details
    const channelInfo = await extractChannelInfo(channelDriver);
    const top12Videos = await extractTop12Videos(channelDriver);

    // Calculate average views of the top 12 videos
    const averageViews = await calculateAverageViews(
      top12Videos,
      channelDriver
    );

    // Create the response object
    const responseData = {
      title: channelInfo.title,
      description: channelInfo.description,
      averageViews,
      subscriberCount: channelInfo.subscriberCount,
    };

    await channelDriver.quit();

    // Send the response
    res.json(responseData);
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching channel data: " + error);
  }
});

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
