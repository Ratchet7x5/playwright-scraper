const path = require('path');
const { chromium } = require('playwright');
let fs = require('fs');

getBarfootRentData();

async function getBarfootRentData() {
  console.log('now attempting to grab barfoot rental data...');

  let pathToExtension_uBlock = path.join(process.cwd(), './extensions/uBlock0.chromium/');

  const context = chromium
    .launchPersistentContext('', {
      channel: 'chrome',
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension_uBlock}`,
        `--load-extension=${pathToExtension_uBlock}`,
        '--disable-lazy-loading'
      ]
    })
    .then(async (browser) => {
      const page = await browser.newPage();

      await page.goto(
        'https://www.barfoot.co.nz/properties/rental/', //suburb=hillsborough
        { waitUntil: 'networkidle' }
      );

      // innerHTML gives you the HTML and anything inside it, so <div class=something><p/></div>
      // innerText gives you just the text from elements
      let numOfProperties = await page.locator('.showing-mobile').allInnerTexts();
      console.log(numOfProperties);

      let propertyData = await page.locator('.property-details').allInnerTexts();

      //loop a few times?
      let numProps = Math.ceil(Number.parseInt(numOfProperties) / 48) - 1;

      for (let pages = 0; pages < numProps; pages++) {
        //go to end of page by clicking "end" key
        await page.keyboard.press('PageDown', { delay: 1000 });

        //check for a next button, if it's false, exit the loop
        if ((await page.getByText('Next >')) == undefined) {
          break;
        } else {
          await page.getByText('Next >').click();
        }

        await page.waitForLoadState('domcontentloaded');

        propertyData = propertyData.concat(await page.locator('.property-details').allInnerTexts());

        let pageNum = await page.url();
        console.log(pageNum);
      }

      cleanBarfootData(propertyData);

      console.log('Number of properties for rent: ' + numOfProperties + ', # of pages ' + numProps);
      console.table(propertyData);

      // save propertyData as CSV file
      //saveToCSV(propertyData);

      //construct SQL query
      /**
       * Table Property { Address (String), Suburb (String), Rent (Int), Bed (Int), Bath (Int), Car (Int) }
       */

      //await browser.close();
    });
}

function saveToCSV(propertyData) {
  //start
  //csv filename should be:
  //barfoot_dd_mm_yy_hh_mm_ss
  let date_ob = new Date();
  let day = ('0' + date_ob.getDate()).slice(-2);
  let month = ('0' + (date_ob.getMonth() + 1)).slice(-2);
  let year = date_ob.getFullYear() % 100;
  let hours = date_ob.getHours();
  let minutes = date_ob.getMinutes();
  let seconds = date_ob.getSeconds();

  let csvFileName = './' + day + '_' + month + '_' + year + '_' + hours + 'h_' + minutes + 'm_' + seconds + 's.csv';
  console.log(csvFileName);

  let csvData = ['Address,Suburb,Rent,Bed,Bath,Car\r'];
  csvData = csvData.concat(propertyData);

  var csvFile = fs.createWriteStream(csvFileName, { encoding: 'utf-8' });

  csvFile.on('error', function (err) {
    //error handling
  });

  csvData.forEach((element) => csvFile.write(element + '\r'));
  csvFile.end();

  console.log('file written to: ' + csvFileName);
}

function cleanBarfootData(data) {
  //console.log("raw data");
  //console.table(data);

  for (let index = 0; index < data.length; index++) {
    data[index] = data[index].replace('AVAILABLE NOW\n', '');
    data[index] = data[index].replace(' per week\n', ', ');
    data[index] = data[index].replaceAll('\n', ', ');
    //data[index] = data[index].replace(/[$,]/g, "");
    data[index] = data[index].replace(' Bed', ', ');
    data[index] = data[index].replace(' Bath', ', ');
    data[index] = data[index].replace(' Car', '');

    let dollarIndex = data[index].indexOf('$');
    let spaceIndex = dollarIndex + 1;
    let fullValue = '';

    while (data[index].at(spaceIndex) != ' ') {
      fullValue += data[index].at(spaceIndex);
      spaceIndex++;
    }

    fullValue = fullValue.replaceAll(',', '');
    fullValue += ',';

    let newString =
      data[index].substring(0, dollarIndex) + fullValue + data[index].substring(spaceIndex, data[index].length);

    data[index] = newString;
  }

  //TODO: Entries must have 6 fields instead of 5, 7, or anything else.
  // Edge cases:
  // 757 State Highway 16 , Kumeu, 2400, 4, 2, 5
  // Kerikeri, 795, 4, 2, 4
  // 2/685 Karioitahi Road, Waiuku, 300, 1, 1,
  // Room 4, 28 Court Crescent, Panmure, 210, 1, 1, 2

  //console.log("processed data");
  //console.table(data);
}
