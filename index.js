const csv = require('csv-parser')
const humanizeDuration = require("humanize-duration");
const fs = require('fs')
let results = [];
let parameterResults = {};
let startOfMidSection = 0;
let endOfMidSection = 0;

const SAMPLE_FREQ = 1800
const FREQ_CHANNEL = 75
const STEP_INCREMENT = 1
const SHIFT_STEP = 6

const SAMPLES_PER_PERIOD = SAMPLE_FREQ / FREQ_CHANNEL


let file = 'Dronten_2632CT_20220316_105957_1800Hz.csv'
readCSVAndWriteOutput(file)

function readCSVAndWriteOutput(file) {
    fs.createReadStream(`data/${file}`)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            console.time("TimeSpentCalculatingParameters");

            let torqueValues = calculateTorque(results);
            let averageValues = calculateAverages(torqueValues);
            let midSection = findMidSection(averageValues);

            calculateParameters(midSection);
            console.log(parameterResults);


            console.timeEnd("TimeSpentCalculatingParameters");

            let csvContent = generateCsvContent(averageValues);

            fs.writeFile(`out/${file}_output.csv`, csvContent, err => {
                if (err) {
                    console.error(err);
                } else {
                    console.log("CSV written.")
                }
            });

            fs.writeFile(`out/${file}_parameters.json`, JSON.stringify(parameterResults, null, 4), err => {
                if (err) {
                    console.error(err);
                } else {
                    console.log("Parameters written.")
                }
            });
        });

    results = []; // reset results
    parameterResults = {};
}

function movingAverage(midSection) {
    let min = midSection[0];
    let max = midSection[0];

    for (let i = 0; i < midSection.length; i+=15) {
        periodAverage = 0;
        for (let j = 0; j < 15; j++) {
            periodAverage += midSection[i+j];
        }
        periodAverage = periodAverage / 15;
        
        if (periodAverage < min) min = periodAverage;
        if (periodAverage > max) max = periodAverage;
    }

    parameterResults.MaxTorqueMid = max;
    parameterResults.MinTorqueMid = min;
}

function surfaceArea(midSection)
{
    let middleSectionCopy = [...midSection];

    let totalSurface = 0;
    for (let i = 0; i < middleSectionCopy.length; i++) {
        // negative koppelwaardes op 0
        if (middleSectionCopy[i] < 0) 
            middleSectionCopy[i] = 0;

        // vermingvuldigen met 1/75
        totalSurface += middleSectionCopy[i];
    }

    let avgSurface = totalSurface / middleSectionCopy.length;

    return avgSurface;
}


function findMidSection(averageValues) {
    let startFound = false;
    let endFound = false;

    // Look at 5 samples and average that
    for (let index = 0; index < averageValues.length; index++) {

        if (!startFound) {
            let avg = 0;
            for (let avgIndex = 0; avgIndex < 5; avgIndex++) {
                avg += averageValues[index + avgIndex];
            }
            avg = avg / 5;
            
            let currentMid = averageValues[startOfMidSection];

            if (avg.toFixed(3) < currentMid.toFixed(3)) {
                startOfMidSection = index;
                startFound = true;
                // console.log(`${avg.toFixed(3)} < ${currentMid.toFixed(3)} = ${startOfMidSection}`);
                // console.log(`Start of mid section = Index ${startOfMidSection}: `, averageValues[startOfMidSection]);
                endOfMidSection = index + 10;
                index+=10;
            }
        }

        if (!endFound) {
            let avg = 0;
            for (let avgIndex = 0; avgIndex < 5; avgIndex++) {
                avg += averageValues[index + avgIndex];
            }
            avg = avg / 5;
            
            let currentMid = averageValues[endOfMidSection];

            if ((avg - currentMid) > 0.001) {
                endOfMidSection = index;
                endFound = true;
                // console.log(`${avg} - ${currentMid} = ${avg - currentMid} = ${endOfMidSection}`);
                // console.log(`End of mid section = Index ${endOfMidSection}: `, averageValues[endOfMidSection]);
            }
        }
        
    }

    let middleSection = averageValues.slice(startOfMidSection, endOfMidSection);

    let timeMeasured = middleSection.length * (SAMPLES_PER_PERIOD / SAMPLE_FREQ);
    parameterResults.TimeMeasured = timeMeasured;
    
    // midden van het midden
    let length = middleSection.length;
    let slice = length / 3;
    let start = Math.round(slice);
    let end = slice * 2;

    let middleOfMiddleSection = middleSection.slice(start, end);

    return middleOfMiddleSection;
}

function calculateParameters(midSection) {
    calculateAverageSections(midSection);
    movingAverage(midSection)
    
    let avgSurfaceArea = surfaceArea(midSection);
    parameterResults.AvgSurfaceArea = avgSurfaceArea;
}

function calculateAverageSections(midSection) {

    let sortedValues = midSection.sort();

    let q1 = Math.round(sortedValues.length * 0.25);
    let q2 = Math.round(sortedValues.length * 0.50);
    let q3 = Math.round(sortedValues.length * 0.75);

    let avgFirstQuartileMidSection = sortedValues[q1];
    let avgSecondQuartileMidSection = sortedValues[q2];
    let avgThirdQuartileMidSection = sortedValues[q3];

    parameterResults.AvgFirstQuartileMidSection = avgFirstQuartileMidSection;
    parameterResults.AvgSecondQuartileMidSection = avgSecondQuartileMidSection;
    parameterResults.AvgThirdQuartileMidSection = avgThirdQuartileMidSection;
}

function calculateTorque(rawDataArray) {
    let torqueValues = []

    for (let index = 0; index < rawDataArray.length; index = index + STEP_INCREMENT) {

        /**
         * This would be the part where we phase shift the data. But data from the TMS is already phase shifted, we won't do it twice.
         */
        // if (index + SHIFT_STEP < rawDataArray.length) // Shift by 7 samples = sin(90)
        //     torqueValues.push(rawDataArray[index + SHIFT_STEP].Spoorfase_1800Hz * rawDataArray[index].Localefase_1800Hz);
        
        torqueValues.push(rawDataArray[index].Spoorfase_1800Hz * rawDataArray[index].Localefase_1800Hz);
    }

    console.log("Samples per second: ", SAMPLES_PER_PERIOD)
    console.log("Amount of torque values: ", torqueValues.length)

    return torqueValues;
}

function calculateAverages(torqueValues) {
    let averageValues = [];

    for (let j = 0; j < torqueValues.length; j = j + SAMPLES_PER_PERIOD) {
        let totalOfTorqueValues = 0;
        for (let x = 0; x < SAMPLES_PER_PERIOD; x++) {
            if (torqueValues[j + x] == undefined) break;
            totalOfTorqueValues += torqueValues[j + x];
        }
        averageValues.push(totalOfTorqueValues / SAMPLES_PER_PERIOD);
    }

    return averageValues;
}

function generateCsvContent(averageValues) {
    let content = "#,Torque\n"
    averageValues.forEach((avgValue, index) => {
        content += `${index},${avgValue}\n`
    });
    return content;
}