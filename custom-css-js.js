const HIGHEST_Z_INDEX = 2147483647;
const HIGHEST_Z_INDEX_MINUS_1 = 2147483647 - 1;
const HIGHEST_Z_INDEX_MINUS_2 = 2147483647 - 2;

const style = /*css*/ `
        #toyota-open,
        #toyota-close {
            cursor: pointer;
            z-index: ${HIGHEST_Z_INDEX_MINUS_1} !important;
        }

        #toyota-disclaimer {
            z-index: ${HIGHEST_Z_INDEX} !important;
            transition: visibility 0.3s, opacity 0.3s;
            opacity: 0 !important;
            visibility: hidden;
            pointer-events: none !important;
        }

        #toyota-disclaimer .pointer-events-all {
            pointer-events: none !important;
        }

        #toyota-disclaimer.opened {
            opacity: 1 !important;
            visibility: visible;
        }

        #toyota-disclaimer.opened .pointer-events-all {
            pointer-events: all !important;
        }

        #toyota-disclaimer:not(.hovered) {
            pointer-events: all !important;
        }

        #toyota-disclaimer.hovered {
            z-index: ${HIGHEST_Z_INDEX_MINUS_2} !important;
        }

        #click-overlay {
            position: relative;
            z-index: ${HIGHEST_Z_INDEX_MINUS_2} !important;
            width: 100vw;
            height: 100vh;
        }
    `
    .replace(/\n/g, "")
    .replace(/\s+/g, " ");

const script = /*js*/ `
        let timer;

        function disclaimer () {
            const element = document.getElementById('toyota-disclaimer');
            if (!element) throw new Error('Element #toyota-disclaimer not found!');
            return element;
        }

        function openDisclaimer () {
            clearTimeout(timer);
            disclaimer().classList.add('opened');
        }
        function closeDisclaimer () {
            clearTimeout(timer);
            disclaimer().classList.remove('opened');
            disclaimer().classList.remove('hovered');
        }
        function hoverOpenDisclaimer () {
            clearTimeout(timer);
            disclaimer().classList.add('opened');
            disclaimer().classList.add('hovered');
        }
        function deferredCloseDisclaimer (e) {
            timer = setTimeout(closeDisclaimer, 500);
        }
        function openClickTag () {
            console.log('x', window.clickTag);
            window.open(window.clickTag);
        }
    `
    .replace(/\n/g, "")
    .replace(/\s+/g, " ");

module.exports = {
    style,
    script
}
