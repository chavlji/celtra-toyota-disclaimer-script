const HIGHEST_Z_INDEX = 2147483647;

const style = /*css*/ `
        #toyota-open,
        #toyota-close {
            cursor: pointer;
        }

        #toyota-disclaimer {
            z-index: ${HIGHEST_Z_INDEX};
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
    `
    .replace(/\n/g, "")
    .replace(/\s+/g, " ");

module.exports = {
    style,
    script
}
