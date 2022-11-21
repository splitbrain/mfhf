class FireHose {
    /**
     *
     * @param {string[]} instances List of instances to monitor
     * @param {Node} output DOM element to output to
     */
    constructor(instances, output) {
        this.output = output;
        this.stats = {
            conn: 0,
            all: 0,
            match: 0
        };
        instances.map(this.drink.bind(this));
        this.setQuery('');
    }

    /**
     * Set a new query to monitor for, reset the output area
     *
     * @param query
     */
    setQuery(query) {
        this.seen = new Set();
        this.stats.all = 0;
        this.stats.match= 0;

        if (query) {
            this.re = new RegExp(query, 'i');
            this.output.innerHTML = '';
        } else {
            this.re = null;
            this.output.innerHTML = '<p>Enter a filter to drink from the fire hose</p>';
        }
    }

    /**
     * Open the websocket to the given instance and start monitoring the firehose
     *
     * @param {string} instance Base instance name
     */
    drink(instance) {
        try {
            const webSocket = new WebSocket(`wss://${instance}/api/v1/streaming/?`);

            webSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.event !== 'update') return;
                const toot = JSON.parse(data.payload);
                this.filterToot(toot);
            }

            webSocket.onopen = () => {
                this.stats.conn++;

                webSocket.send(JSON.stringify({
                    "type": "subscribe",
                    "stream": "public"
                }));
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * Decide if this toot should be shown, if so pass it on to displayToot()
     *
     * @param {object} toot
     */
    filterToot(toot) {
        if (!this.re) return;
        this.stats.all++;
        if (this.seen.has(toot.url)) return;
        if (!this.re.test(toot.content)) return;
        this.stats.match++;
        this.displayToot(toot);
    }

    /**
     * Display the given toot
     *
     * Creates the HTML and adds the toot to the seen list
     *
     * @param {object} toot
     */
    displayToot(toot) {
        this.seen.add(toot.url);

        const wrapper = document.createElement('article');
        wrapper.className = 'toot';

        const content = document.createElement('div');
        content.className = 'content';
        content.innerHTML = toot.content;
        wrapper.append(content);

        const meta = document.createElement('div');
        meta.className = 'meta';
        wrapper.append(meta);

        const author = document.createElement('a');
        author.className = 'author';
        author.href = toot.account.url;
        author.innerText = toot.account.display_name;
        meta.append(author);

        const posted = document.createElement('a');
        posted.className = 'posted';
        posted.href = toot.url;
        posted.innerText = toot.created_at;
        meta.append(posted)

        this.output.prepend(wrapper);
    }

    getStats() {
        return this.stats;
    }
}

/**
 * We probably want the most popular instances here
 *
 * @type {string[]}
 */
const instances = [
    'mastodon.social',
    'octodon.social',
    'mastodon.art',
    'fosstodon.org',
    'chaos.social',
    'infosec.exchange',
    'hachyderm.io'
];

// start the firehose sockets
const FH = new FireHose(instances, document.querySelector('.output'));

// handle input form
document.querySelector('header form').onsubmit = (event) => {
    event.preventDefault();
    event.stopPropagation();
    FH.setQuery(event.target.elements.query.value);
}

// update statistics
const statOut = document.querySelector('.stats');
setInterval(()=>{
    const stats = FH.getStats();
    statOut.innerText = `Connected to ${stats.conn}  instances. Matched ${stats.match} of ${stats.all} seen posts.`;
}, 1000);
