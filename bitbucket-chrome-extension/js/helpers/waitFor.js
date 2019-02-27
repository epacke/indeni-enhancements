/**
 * Waits for the dom to contain a specific selector
 * @return {Promise} A new database document based on the state of the check boxes
 * @param {string} selector The css selector mathching the object you want to wait for
 * @param {int} interval The interval in milliseconds
 * @param {int} maxRounds Maximum rounds to check before giving up
 * @example
 *     waitFor('a.view-file', 1000, 20)
 */

function waitFor(selector, interval, maxRounds){

    return new Promise(function(resolve, reject){

        var i = 0;
        var timer = setInterval(function(){
            if($(selector).length > 0){
                clearInterval(timer);
                resolve();
            } else {
                i++
                if(i >= maxRounds){
                    clearInterval(timer);
                    reject(`Time limit expired when looking for ${selector}`);
                }
            }
        }, interval);

    })

}