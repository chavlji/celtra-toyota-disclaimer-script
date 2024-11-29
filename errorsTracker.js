class ErrorsTracker {
    constructor() {
        this.errors = [];
    }

    add(error) {
        this.errors.push(error);
    }

    report() {
        if (this.errors.length === 0) {
            console.log('No errors to report.');
        } else {
            console.log('Errors:')
            const errorsCounts = {}
            this.errors.filter(result => result !== true).forEach(error => {
                errorsCounts[error] = (errorsCounts[error] || 0) + 1
            })
            Object.entries(errorsCounts).forEach(([error, count]) => {
                console.log(`    ${count}x "${error}"`)
            })
        }
    }
}

module.exports = ErrorsTracker
