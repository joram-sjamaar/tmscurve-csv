const csv = require('csv-parser')
const fs = require('fs')
let results = [];

const SAMPLE_FREQ = 1800
const FREQ_CHANNEL = 75
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

    for (let index = 0; index < rawDataArray.length; index++) {
        if (index + 6 < rawDataArray.length) // Shift by 7 samples = sin(90)
            torqueValues.push(rawDataArray[index + 6].Spoorfase_1800Hz * rawDataArray[index].Localefase_1800Hz);
    }

    return torqueValues;
}

function calculateAverages(torqueValues) {
    let averageValues = [];

    for (let j = 0; j < torqueValues.length; j = j + SAMPLES_PER_PERIOD) {
        let totalOf24TorqueValues = 0;
        for (let x = 0; x < SAMPLES_PER_PERIOD; x++) {
            if (torqueValues[j + x] == undefined) break;
            totalOf24TorqueValues += torqueValues[j + x];
        }
        averageValues.push(totalOf24TorqueValues / SAMPLES_PER_PERIOD);
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