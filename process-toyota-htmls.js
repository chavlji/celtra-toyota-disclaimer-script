const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const archiver = require("archiver");
const { promisify } = require("util");

const { style, script } = require('./custom-css-js.js');
const ErrorsTracker = require("./ErrorsTracker.js");

const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

const COLOR_OPEN = "rgba(87, 231, 50, 1)";
const COLOR_OPEN_HEX = "#57E732";
const COLOR_HOVER_OPEN = "rgb(228, 144, 24)";
const COLOR_HOVER_OPEN_HEX = "#E49018";
const COLOR_CLOSE = "rgba(230, 37, 23, 1)";
const COLOR_CLOSE_HEX = "#E62517";
const COLOR_DISCLAIMER = "rgba(31, 69, 236, 1)";
const COLOR_DISCLAIMER_HEX = "#1F45EC";

var errorsTracker = new ErrorsTracker();

main('exports').catch((err) => console.error("Error:", err));

async function main (exportsFolder) {
    const currentFolder = process.cwd();

    const exportsZip = path.join(currentFolder, process.argv[2]);

    const extractPath = path.join(currentFolder, '.processing');
    await mkdir(extractPath, { recursive: true });
    await unzipToFolder(exportsZip, extractPath);

    const inputFolder = path.join(currentFolder, exportsFolder);
    const outputFolder = path.join(currentFolder, "processed");

    const results = await processFolder(inputFolder, outputFolder)

    const allZipFiles = results.filter(result => !!result).length
    const failed = results.filter(result => !result).length
    console.log(`\n${allZipFiles - failed}/${allZipFiles} zip files processed\n`)

    errorsTracker.report()

    console.log(`\nCheck successfully processed files in "${outputFolder}"`)
}

async function processFolder (inputFolder, outputFolder) {
    await fs.promises.rm(outputFolder, { recursive: true, force: true });
    await mkdir(outputFolder, { recursive: true });

    const results = []

    const files = await readdir(inputFolder);
    for (const file of files) {
        if (path.extname(file) === ".zip") {
            results.push(...await processZipFile(path.join(inputFolder, file), outputFolder));
        }
    }

    return results
};

const processZipFile = async (filePath, outputFolder) => {
    const fileName = path.basename(filePath, ".zip");
    const extractPath = path.join(outputFolder, fileName);

    await unzipToFolder(filePath, extractPath);

    const result = []

    let indexHtmlFound

    result.push(true)

    const files = await readdir(extractPath);

    for (const file of files) {
        const fullPath = path.join(extractPath, file);
        const stats = await stat(fullPath);
        if (stats.isFile() && file === "index.html") {
            indexHtmlFound = true
            const newHtml = processHtml(await fs.promises.readFile(fullPath, "utf8"));
            if (!newHtml) {
                await fs.promises.rm(extractPath, { recursive: true, force: true });
                result.push(false)
                return result
            }
            await writeFile(fullPath, newHtml, "utf8");
        }
    }

    if (!indexHtmlFound) {
        errorsTracker.add('No index.html file found inside zip')
    }

    const zipFileWithPath = path.join(outputFolder, `${fileName}.zip`);
    await zipFolder(extractPath, zipFileWithPath);

    return result
};

async function zipFolder(folderWithPath, outputFileWithPath) {
    const output = fs.createWriteStream(outputFileWithPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(folderWithPath, false);
    await archive.finalize();

    await fs.promises.rm(folderWithPath, { recursive: true, force: true });
}

async function unzipToFolder (filePath, outputFolder) {
    await fs.promises.mkdir(outputFolder, { recursive: true });
    await fs
        .createReadStream(filePath)
        .pipe(unzipper.Extract({ path: outputFolder }))
        .promise();
}

function processHtml(html) {
    html = { value: html }

    if (!checkDivsParser(html.value)) {
        errorsTracker.add(`FATAL: Div elements parser error`)
        return false
    }

    html.value = html.value.replace(/<div[^<]*id="click-overlay"[^>]*?><\/div>/g, "");

    const buttonOpen = addComponentAttributes(html, [COLOR_OPEN, COLOR_OPEN_HEX], 'id="toyota-open" onclick="openDisclaimer()"')

    const buttonClose = addComponentAttributes(html, [COLOR_CLOSE, COLOR_CLOSE_HEX], 'id="toyota-close" onclick="closeDisclaimer()"')

    if (buttonOpen && !buttonClose) {
        errorsTracker.add('Open button exists, but no close button found')
        return
    }

    const hoverButton = addComponentAttributes(html, [COLOR_HOVER_OPEN, COLOR_HOVER_OPEN_HEX], 'id="toyota-close" onmouseover="hoverOpenDisclaimer()" onmouseout="deferredCloseDisclaimer()"')

    const disclaimer = addComponentAttributes(html, [COLOR_DISCLAIMER, COLOR_DISCLAIMER_HEX], 'id="toyota-disclaimer"')

    if (disclaimer && !(buttonOpen || !hoverButton)) {
        errorsTracker.add('Disclaimer exists, but no trigger button found')
        return
    }

    if ((buttonOpen || hoverButton) && !disclaimer) {
        errorsTracker.add('Trigger button exists, but no disclaimer found')
        return
    }

    html.value = html.value.replace("</style>", `${style}</style>`);
    html.value = html.value.replace("</script>", `${script}</script>`);

    const knownColors = [COLOR_OPEN, COLOR_OPEN_HEX, COLOR_HOVER_OPEN, COLOR_HOVER_OPEN_HEX, COLOR_CLOSE, COLOR_CLOSE_HEX, COLOR_DISCLAIMER, COLOR_DISCLAIMER_HEX];
    html.value = removeStrokes(html.value, knownColors);

    return html.value;
}

function checkDivsParser(html) {
    const divs = enumerateDivs(html)
    const matches = html.match(/<div\s/g)
    return matches.length === divs.length
}

function addComponentAttributes (html, strokeColors, attributes) {
    const divs = enumerateDivs(html.value);
    const componentHtml = findComponentDiv(divs, strokeColors);
    if (!componentHtml) return false;

    html.value = html.value.replace(componentHtml, addAttribute(componentHtml, attributes));
    return true;

    function findComponentDiv(divs, subStrings) {
        for (const subString of subStrings) {
            const div = findDiv(divs, subString)
            if (div) return div
        }

        function findDiv(divs, subString) {
            return divs
                .filter((div) => div.match(/^[^>]*class="component/))
                .filter((div) => div.includes(subString))
                .sort((a, b) => a.length - b.length)[0];
        }
    }

    function addAttribute(div, str) {
        const start = "<div ";
        return start + str + " " + div.substring(start.length, div.length);
    }
}

function removeStrokes (html, strokeColors) {
    strokeColors.forEach(strokeColor => {
        html = html.replaceAll(`stroke="${strokeColor}"`, "")
    })
    return html;
}

function enumerateDivs(html) {
    const openings = [...html.matchAll(/<div[^>]*[^/]?>/g)]
        .map((match) => ({ match: match[0], index: match.index, type: "open" }))
        .filter(({ match }) => !match.endsWith("/>"));

    const closings = [...html.matchAll(/<\/\s*div\s*>/g)].map((match) => ({
        match: match[0],
        index: match.index,
        type: "close",
    }));

    const boundaries = [...openings, ...closings]
        .sort((a, b) => a.index - b.index)
        .map((boundary, i) => ({ ...boundary, i }));

    const open = [];
    const result = [];

    boundaries.forEach((boundary) => {
        if (boundary.type === "open") {
            open.push(boundary);
            return;
        }
        const closing = boundary;
        const opening = open.pop();
        const divOuterHtml = html.substring(
            opening.index,
            closing.index + closing.match.length
        );
        result.push(divOuterHtml);
    });

    const selfClosingDivs = html.match(/<div[^>]*\/>/g) || []

    return [...result, ...selfClosingDivs];
}

// const html = `<div class="x">First div</div><div>Second div <div>Nested div</div></div>
//   <div class="selfclose" />
//   <div class="first" attr="x/">Second div <div>Nested div</div></div>`
// console.log(enumerateDivs(html));
