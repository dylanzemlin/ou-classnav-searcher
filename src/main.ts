#!/usr/bin/env node

import camelcase from "camelcase";
import inquirer from "inquirer";
import axios from "axios";
import ora from "ora";
import fs from "fs";

const CLASSNAV_URL = "https://classnav.ou.edu/index_ajax.php?iColumns=18&iDisplayLength=30&semester=202220&subject=all&schedule=all&delivery=all&term=all&available=false&waitlist=false";

const cacheClasses = async () => {
    const spinner = ora("Fetching classes").start();

    const { data } = await axios.get(CLASSNAV_URL);

    spinner.succeed("Fetched classes");

    await new Promise((resolve) => setTimeout(resolve, 1000));

    spinner.text = "Parsing classes";
    spinner.start();
    
    // Parse the data
    const classes = data.aaData.map((classData: any) => {
        let [index, crn, subject, course, section, title, primaryInstructor, deliveryType, deliveryMethod, educationType, semesterLength, dates, unknown, packedInfo, description, allInstructors, unknown_2, packedInfo_2] = classData;
        
        index = index.replace(/<.*?>/g, "")?.trim();

        let packedBits = packedInfo.split(",");
        let startTime = packedBits[2];
        let endTime = packedBits[3];
        let location = packedBits[4];
        let room = packedBits[5];
        let shortDays = packedBits[6];

        allInstructors = allInstructors.split(",").map((instructor: string) => instructor?.trim()).filter((instructor: string) => instructor !== "");

        // Trim all entries
        try {
            crn = crn?.trim();
            subject = subject?.trim();
            course = course?.trim();
            section = section?.trim();
            title = title?.trim();
            primaryInstructor = primaryInstructor?.trim();
            deliveryType = deliveryType?.trim();
            deliveryMethod = deliveryMethod?.trim();
            educationType = educationType?.trim();
            semesterLength = semesterLength?.trim();
            dates = dates?.trim();
            startTime = startTime?.trim();
            endTime = endTime?.trim();
            location = location?.trim();
            room = room?.trim();
            description = description?.trim();
        } catch (e) {
            console.log(e);
            console.log(classData);
        }

        return {
            index,
            crn,
            subject,
            course,
            section,
            title,
            primaryInstructor,
            deliveryType,
            deliveryMethod,
            educationType,
            semesterLength,
            dates,
            startTime,
            endTime,
            location,
            room,
            description,
            allInstructors,
            shortDays: shortDays?.trim()
        };
    });

    spinner.succeed("Parsed classes");

    // Write the data to a file
    fs.writeFileSync("classes.json", JSON.stringify(classes));
}

const search = async (filters: any) => {

    const spinner = ora("Reading cached classes").start();

    const classes = JSON.parse(fs.readFileSync("classes.json", "utf-8"));
    await new Promise((resolve) => setTimeout(resolve, 500));

    spinner.succeed("Read cached classes");

    // Filter data based on filters
    const results = classes.filter((classData: any) => {
        for (const filter in filters) {
            if (!classData[filter]?.toLowerCase().includes(filters[filter]?.toLowerCase())) {
                return false;
            }
        }

        return true;
    });

    // Display results
    results.forEach((result: any) => {
        console.log(`\n${result.subject} ${result.course}-${result.section} | ${result.title} (${result.crn})`);
        console.log(`\tPrimary Instructor: ${result.primaryInstructor}`);
        console.log(`\tLocation: ${result.location}`);
        console.log(`\tRoom: ${result.room}`);
        console.log(`\tTime: ${result.startTime} - ${result.endTime}`);
        console.log(`\tDays: ${result.shortDays}`);
    });
}

// findClassesByRoom("Gallogly", "")
// cacheClasses();

let filters: any = {};
async function cli_loop() {
    // Give user a list of filters (location, room, crn, subject, course, section, shortDays) and a search button\
    const { filter } = await inquirer.prompt([
        {
            type: "list",
            name: "filter",
            message: "What would you like to filter by?",
            choices: [
                "Location" + (filters.location ? ` (${filters.location})` : ""),
                "Room" + (filters.room ? ` (${filters.room})` : ""),
                "CRN" + (filters.crn ? ` (${filters.crn})` : ""),
                "Subject" + (filters.subject ? ` (${filters.subject})` : ""),
                "Course" + (filters.course ? ` (${filters.course})` : ""),
                "Section" + (filters.section ? ` (${filters.section})` : ""),
                "Short Days" + (filters.shortDays ? ` (${filters.shortDays})` : ""),
                "None"
            ],
            loop: false
        },
    ]);

    if (filter === "None") {
        search(filters);
        return;
    }

    if(filter === "Short Days") {
        const { shortDays } = await inquirer.prompt([
            {
                type: "checkbox",
                name: "shortDays",
                message: "What days would you like to filter by?",
                choices: ["M", "T", "W", "R", "F"],
                loop: false
            }
        ]);

        filters.shortDays = shortDays.join("");
        await cli_loop();
        return;
    }

    const { value } = await inquirer.prompt([
        {
            type: "input",
            name: "value",
            message: "What is the value of the filter?"
        }
    ]);

    filters[camelcase(filter.toLowerCase())] = value;
    await cli_loop();
}

async function main() {
    // Check if classes.json exists
    if (!fs.existsSync("classes.json")) {
        await cacheClasses();
    }

    await cli_loop();
}

await main();