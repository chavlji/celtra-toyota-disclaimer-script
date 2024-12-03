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

const DEBUG = process.argv.map(a => a.toLowerCase()).includes('--debug');

const currentFolder = process.cwd();
const passedFileName = process.argv[2]
const inputZipFile = path.isAbsolute(passedFileName) ? passedFileName : path.join(currentFolder, passedFileName);

var errorsTracker = new ErrorsTracker();

main(inputZipFile).catch((err) => console.error("Error:", err));

async function main (zipWithExports) {
    if (!fs.existsSync(zipWithExports)) {
        console.log(`\nFile not found: ${zipWithExports}`)
        return
    }
    const workDir = path.join(currentFolder, '.processing');
    await fs.promises.rm(workDir, { recursive: true, force: true });
    await mkdir(workDir, { recursive: true });
    await unzipToFolder(zipWithExports, workDir);

    const results = await processFolder(workDir)

    const processedZip = `${removeExtension(zipWithExports)}.processed.zip`
    if (!DEBUG) {
        await zipFolder(workDir, processedZip);
    }

    const allZipFiles = results.filter(result => !!result).length
    const failed = results.filter(result => !result).length
    console.log(`\n${allZipFiles - failed}/${allZipFiles} zip files processed\n`)

    errorsTracker.report()

    const outputPath = DEBUG ? workDir : processedZip
    console.log(`\nOutput file:\n"${outputPath}"`)
}

async function processFolder (inputFolder) {
    const results = []

    const files = await readdir(inputFolder);
    for (const file of files) {
        if (path.extname(file) === ".zip") {
            const errorsCount = errorsTracker.errors.length
            results.push(...await processZipFile(path.join(inputFolder, file)));
            if (errorsTracker.errors.length > errorsCount) {
                console.log(`${file}: ❌ ${errorsTracker.errors[errorsTracker.errors.length - 1]}`)
            } else {
                console.log(`${file}: ✅ Done`)
            }
            // break
        }
    }

    return results
};

const processZipFile = async (zipFile) => {
    const workDir = await quickUnzip(zipFile)

    const result = [true]

    let indexHtmlFound

    const files = await readdir(workDir);

    for (const file of files) {
        const filePath = path.join(workDir, file);
        const stats = await stat(filePath);
        if (stats.isFile() && file === "index.html") {
            indexHtmlFound = true
            const newHtml = processHtml(await fs.promises.readFile(filePath, "utf8"));
            if (!newHtml) {
                await fs.promises.rm(workDir, { recursive: true, force: true });
                result.push(false)
                return result
            }
            await writeFile(filePath, newHtml, "utf8");
        }
    }

    if (!indexHtmlFound) {
        errorsTracker.add('No index.html file found inside zip')
    }

    if (!DEBUG) {
        await zipFolder(workDir, zipFile);
    }
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

async function quickUnzip(zipFile) {
    const extractFolder = path.join(path.dirname(zipFile), path.basename(zipFile, '.zip'))
    await unzipToFolder(zipFile, extractFolder)
    return extractFolder
}

function removeExtension(filePath) {
    const dir = path.dirname(filePath)
    const fileNameWithoutExtension = path.basename(filePath, path.extname(filePath))
    return path.join(dir, fileNameWithoutExtension)
}

function processHtml(html) {
    html = { value: html }

    if (!checkDivsParser(html.value)) {
        errorsTracker.add(`FATAL: Div elements parser error`)
        return false
    }

    html.value = html.value.replace(/<div[^<]*id="click-overlay"[^>]*?><\/div>/g, "");

    html.value = html.value.replace(/<div[^<]*class="screen"[^>]*?>/g, (match) => `${match}<div id="click-overlay" onclick="openClickTag"></div>`);

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
                .filter((div) => div.match(/^[^>]*class="pointer-events-all/))
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
