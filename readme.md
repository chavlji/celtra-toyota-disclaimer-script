1. First time setup: `./npm install`

2. Export creatives
3. Run script: `node process.js [path_to_zip_with_exports]`
    eg.
4. Send processed file: `[path_to_zip_with_exports].processed.zip` to client

# DEBUG
To prevent zipping temporary folders for debug purposes run:
`node process.js [path_to_zip_with_exports] --debug`
You can then easily check each html from folder `.processed` after you run the script.

# EXAMPLE
`node process.js /Users/Person/Desktop/testing-exports.zip`
Send file `/Users/Person/Desktop/testing-exports.processed.zip` to client
