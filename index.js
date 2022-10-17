const csv = require('csv-parser')
const fs = require('fs')
let results = [];

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
            let torqueValues = calculateTorque(results);
            let averageValues = calculateAverages(torqueValues);
            let csvContent = generateCsvContent(averageValues);

            fs.writeFile(`out/${file}_output.csv`, csvContent, err => {
                if (err) {
                    console.error(err);
                } else {
                    console.log("File written.")
                }
            });
        });

    results = []; // reset results
}

function calculateTorque(rawDataArray) {
    let torqueValues = []

    for (let index = 0; index < rawDataArray.length; index = index + STEP_INCREMENT) {
        if (index + SHIFT_STEP < rawDataArray.length) // Shift by 7 samples = sin(90)
            torqueValues.push(rawDataArray[index + SHIFT_STEP].Spoorfase_1800Hz * rawDataArray[index].Localefase_1800Hz);
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