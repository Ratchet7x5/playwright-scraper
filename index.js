const path = require("path");
const { chromium } = require("playwright");
let fs = require("fs");

(async () => {
  let pathToExtension_uBlock = path.join(
    process.cwd(),
    "./extensions/uBlock0.chromium/"
  );

  const context = chromium
    .launchPersistentContext("", {
      channel: "chrome",
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension_uBlock}`,
        `--load-extension=${pathToExtension_uBlock}`,
        "--disable-lazy-loading",
      ],
    })
    .then(async (browser) => {
      const page = await browser.newPage();

      await page.goto(
        "https://www.barfoot.co.nz/properties/rental/", //suburb=hillsborough
        { waitUntil: "networkidle" }
      );

      // innerHTML gives you the HTML and anything inside it, so <div class=something><p/></div>
      // innerText gives you just the text from elements
      let numOfProperties = await page
        .locator(".showing-mobile")
        .allInnerTexts();
      console.log(numOfProperties);

      let propertyData = await page
        .locator(".property-details")
        .allInnerTexts();

      //loop a few times?
      let numProps = Math.ceil(Number.parseInt(numOfProperties) / 48) - 1;

      for (let pages = 0; pages < numProps; pages++) {
        //go to end of page by clicking "end" key
        await page.keyboard.press("PageDown", { delay: 1000 });

        //check for a next button, if it's false, exit the loop
        if ((await page.getByText("Next >")) == undefined) {
          break;
        } else {
          await page.getByText("Next >").click();
        }

        await page.waitForLoadState("domcontentloaded");

        propertyData = propertyData.concat(
          await page.locator(".property-details").allInnerTexts()
        );

        let pageNum = await page.url();
        console.log(pageNum);
      }

      cleanBarfootData(propertyData);

      console.log(
        "Number of properties for rent: " +
          numOfProperties +
          ", # of pages " +
          numProps
      );
      console.table(propertyData);

      // save propertyData as CSV file
      saveToCSV(propertyData);

      //construct SQL query
      /**
       * Table Property { Address (String), Suburb (String), Rent (Int), Bed (Int), Bath (Int), Car (Int) }
       */

      //await browser.close();
    });
})();

function saveToCSV(propertyData) {
  let csvData = ["Address, Suburb, Rent, Bed, Bath, Car"];
  csvData = csvData.concat(propertyData);
  var csvFile = fs.createWriteStream("barfoot_rental_data.csv");
  csvFile.on("error", function (err) {
    /* error handling */
  });
  csvData.forEach((element) => csvFile.write(element + "\n"));
  csvFile.end();

  console.log("file written to: barfoot_rental_data.csv");
}

function cleanBarfootData(data) {
  //console.log("raw data");
  //console.table(data);

  for (let index = 0; index < data.length; index++) {
    data[index] = data[index].replace("AVAILABLE NOW\n", "");
    data[index] = data[index].replace(" per week\n", ", ");
    data[index] = data[index].replaceAll("\n", ", ");
    //data[index] = data[index].replace(/[$,]/g, "");
    data[index] = data[index].replace(" Bed", ", ");
    data[index] = data[index].replace(" Bath", ", ");
    data[index] = data[index].replace(" Car", "");

    let dollarIndex = data[index].indexOf("$");
    let spaceIndex = dollarIndex + 1;
    let fullValue = "";

    while (data[index].at(spaceIndex) != " ") {
      fullValue += data[index].at(spaceIndex);
      spaceIndex++;
    }

    fullValue = fullValue.replaceAll(",", "");
    fullValue += ",";

    let newString =
      data[index].substring(0, dollarIndex) +
      fullValue +
      data[index].substring(spaceIndex, data[index].length);

    data[index] = newString;
  }

  //console.log("processed data");
  //console.table(data);
}
