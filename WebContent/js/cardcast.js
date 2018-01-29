const DECKS_PER_PAGE = 12;
const PAGINATION_WINDOW = 4;
let _cardcastOffset = 0;

class CardcastMenu {
    constructor() {
        this.menu = $('#cardcastMenu');
        this.mdc_menu = new mdc.menu.MDCSimpleMenu(this.menu[0]);
        this.mdc_menu.listen('MDCSimpleMenu:selected', () => this.cardcastOptionsChanged());
        this.mdc_menu.listen('MDCSimpleMenu:cancel', () => this.cardcastOptionsChanged());

        this._toggleNsfw = this.menu.find('#toggleNsfw');

        this._categories = this.menu.find('._categories');
        this.categories = new List(this.menu[0], {
            item: 'category-item-template',
            listClass: '_categories',
            valueNames: ['_name', '_icon', {data: ['value']}]
        });
        this.categories.clear();

        for (let i = 0; i < CardcastMenu.cardcastCategories.length; i++) {
            const category = CardcastMenu.cardcastCategories[i];
            const elm = this.categories.add({
                "_name": category.name,
                "_icon": category.icon,
                "value": category.value
            })[0];
            elm.elm.querySelector('input').setAttribute("id", "category_" + category.value);
            elm.elm.querySelector('label').setAttribute("for", "category_" + category.value);
        }

        this._sort = this.menu.find('._sort');
        this.sort = new List(this.menu[0], {
            item: 'sort-item-template',
            listClass: '_sort',
            valueNames: ['_name', {data: ['value']}]
        });
        this.sort.clear();

        for (let i = 0; i < CardcastMenu.cardcastSorts.length; i++) {
            const orderBy = CardcastMenu.cardcastSorts[i];
            const elm = this.sort.add({"_name": orderBy.print, "value": orderBy.type})[0];
            const input = elm.elm.querySelector('input');
            input.setAttribute("id", "sort_" + orderBy.name);
            elm.elm.querySelector('label').setAttribute("for", "sort_" + orderBy.name);

            if (orderBy.type === "rating") input.checked = true;

            const self = this;
            input.addEventListener('change', function () {
                if (this.checked) {
                    self._sort.find("input[id!=sort_" + orderBy.name + "]").each(function () {
                        $(this).prop("checked", false);
                    });
                }
            })
        }

        const self = this;
        this.searchField = $('#cardcastSearch');
        this.searchField.on('keydown', function (ev) {
            if (ev.keyCode === 13) self.cardcastOptionsChanged();
        });

        this.cardcastOptionsChanged();
    }

    static get cardcastSorts() {
        return [{print: "Rating", name: "rating", type: "rating", default_direction: "desc"},
            {print: "Name", name: "name", type: "name", default_direction: "asc"},
            {print: "Newest", name: "newest", type: "created_at", default_direction: "desc"},
            {print: "Size", name: "size", type: "card_count", default_direction: "desc"}];
    }

    static get cardcastCategories() {
        return [{name: "Books", icon: "book", value: "books"},
            {name: "Community", icon: "people", value: "community"},
            {name: "Gaming", icon: "videogame_asset", value: "gaming"},
            {name: "Movies", icon: "movie", value: "movies"},
            {name: "Music", icon: "music_note", value: "music"},
            {name: "Sports", icon: "directions_run", value: "sports"},
            {name: "Technology", icon: "phonelink", value: "technology"},
            {name: "Television", icon: "tv", value: "television"},
            {name: "Translation", icon: "translate", value: "translation"},
            {name: "Other", icon: "more", value: "other"},
            {name: "Random", icon: "casino", value: "random"}];
    }

    get searchQuery() {
        const val = this.searchField.val();
        return val.length === 0 ? null : val;
    }

    get nsfwAllowed() {
        return this._toggleNsfw.prop('checked');
    }

    get currentCategories() {
        const selected = [];
        this._categories.children().each(function () {
            const self = $(this);
            if (self.find('input').prop('checked')) selected.push(self.attr('data-value'));
        });

        return selected;
    }

    get currentSorting() {
        let selected = "rating";

        this._sort.children().each(function () {
            const self = $(this);
            if (self.find('input').prop('checked')) selected = self.attr('data-value');
        });

        return selected;
    }

    static getCategoryMaterialIconsName(category) {
        for (let i = 0; i < CardcastMenu.cardcastCategories.length; i++) {
            const item = CardcastMenu.cardcastCategories[i];
            if (category === item.value) return item.icon;
        }

        return "other";
    }

    static getDefaultDirectionFor(sort) {
        for (let i = 0; i < CardcastMenu.cardcastSorts.length; i++) {
            const item = CardcastMenu.cardcastSorts[i];
            if (sort === item.value) return item.default_direction;
        }

        return "desc";
    }

    cardcastOptionsChanged() {
        _cardcastOffset = 0;
        loadDecks(this.searchQuery,
            this.currentCategories,
            this.nsfwAllowed,
            this.currentSorting);
    }

    show() {
        this.mdc_menu.open = !this.mdc_menu.open;
    }
}

class CardcastDialog {
    constructor(code) {
        this.cardcast = new Cardcast(code);
        this.dialog = $('#cardcastDetailsDialog');
        this.dialog.find('.mdc-dialog__body--scrollable')[0].scrollTop = 0;
        this.mdc_dialog = new mdc.dialog.MDCDialog(this.dialog[0]);

        this._name = this.dialog.find('._name');
        this._author_category = this.dialog.find('._author-category');
        this._desc = this.dialog.find('._desc');
        this._code = this.dialog.find('._code');
        this._category = this.dialog.find('._category');
        this._calls = this.dialog.find('._calls');
        this._responses = this.dialog.find('._responses');
        this._rating = this.dialog.find('._rating');

        this._callsList = this.dialog.find('#callsList');
        this._responsesList = this.dialog.find('#responsesList');

        const self = this;
        this.cardcast.info(function (data) {
            if (data === undefined) {
                alert("ERROR!");
            } else {
                self._name.text(data.name);
                self._author_category.text(CardcastDialog._createCategoryAndAuthorString(data.category, data.author.username));
                self._desc.text(data.description);
                self._code.text(data.code);
                self._category.text(CardcastMenu.getCategoryMaterialIconsName(data.category));
                self._calls.text("Calls (" + data.call_count + ")");
                self._responses.text("Responses (" + data.response_count + ")");

                self._rating.barrating('destroy');
                self._rating.barrating({
                    theme: 'fontawesome-stars-o',
                    readonly: true,
                    initialRating: data.rating
                });

                self._rating.parent().css('margin-top', '6px');
                self._rating.parent().css('margin-right', '16px');
            }
        });

        this.cardcast.calls(function (calls) {
            if (calls === undefined) {
                alert("ERROR!");
            } else {
                const list = CardcastDialog._initCardsList(self._callsList[0]);
                for (let i = 0; i < calls.length; i++) {
                    list.add({
                        "_text": calls[i].text.join("____"),
                        "black": true
                    });
                }
            }
        });

        this.cardcast.responses(function (calls) {
            if (calls === undefined) {
                alert("ERROR!");
            } else {
                const list = CardcastDialog._initCardsList(self._responsesList[0]);
                for (let i = 0; i < calls.length; i++) {
                    list.add({
                        "_text": calls[i].text[0],
                        "black": false
                    });
                }
            }
        });
    }

    static _initCardsList(container) {
        const list = new List(container, {
            item: 'card-template',
            valueNames: ['_text', {data: ['black']}]
        });
        list.clear();
        return list;
    }

    static _createCategoryAndAuthorString(category, author) {
        let str = "";
        if (category === "other") str += "An ";
        else str += "A ";
        return str + category + " deck created by " + author;
    }

    show() {
        this.mdc_dialog.show();
    }
}

let cardcastMenu = new CardcastMenu();

function loadDecks(query = null, category, nsfw, sort) {
    const container = document.getElementById('cardcast-container');
    const list = new List(container, {
        valueNames: ['_name', '_category', '_author', '_sample', {data: ['code']}],
        item: 'cardcast-deck-template',
        paginationClass: 'not-pagination'
    });

    Cardcast.decks(query, category.join(','), CardcastMenu.getDefaultDirectionFor(sort), DECKS_PER_PAGE, nsfw, _cardcastOffset, sort, function (data) {
        list.clear();

        const results = data.results.data;
        for (let i = 0; i < results.length; i++) {
            const item = results[i];

            const elm = list.add({
                "_name": item.name,
                "code": item.code,
                "_category": CardcastMenu.getCategoryMaterialIconsName(item.category),
                "_author": "by " + item.author.username,
                "_sample": _createSamplePhrase(item.sample_calls, item.sample_responses.slice())
            })[0];

            const rating = $(elm.elm.querySelector('.\_rating'));
            rating.barrating({
                theme: 'fontawesome-stars-o',
                readonly: true,
                initialRating: item.rating
            });
        }

        // TODO: Handle empty list

        document.querySelector('main').scrollTop = 0;
        generatePagination(container.querySelector('.pagination__inner'), data.results.count);
    })
}

function _createSamplePhrase(calls, responses) {
    if (calls.length === 0 || responses.length === 0) return "";
    const randomCall = calls[Math.floor((Math.random() * calls.length))];
    const randomResp = [];
    const neededResponses = randomCall.text.length - 1;

    for (let i = 0; i < neededResponses; i++) {
        const index = Math.floor(Math.random() * (responses.length - 1));
        randomResp.push(responses[index]);
        responses.splice(index, 1);
    }

    let str = "";
    for (let i = 0; i < neededResponses; i++) {
        str += randomCall.text[i];
        str += "<b>";
        str += randomResp[i].text[0];
        str += "</b>";
    }

    return str + randomCall.text[neededResponses];
}

function generatePagination(container, itemCount) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    let currPage = Math.floor(_cardcastOffset / DECKS_PER_PAGE);
    if (currPage !== 0) {
        const prev = document.createElement("button");
        prev.className = "mdc-button";
        prev.innerHTML = "&laquo;";
        container.appendChild(prev);
        prev.addEventListener('click', function () {
            changePage(currPage - 1);
        });
    }

    const maxPages = Math.ceil(itemCount / DECKS_PER_PAGE);

    let startPage = 0;
    if (currPage > PAGINATION_WINDOW) startPage = currPage - PAGINATION_WINDOW;

    let endPage = currPage + 1 + PAGINATION_WINDOW;
    if (endPage > maxPages) endPage = maxPages;

    for (let i = startPage; i < endPage; i++) {
        const page = document.createElement("button");
        page.className = "mdc-button";
        if (i === currPage) page.className += " mdc-button--raised";
        page.innerText = (i + 1).toString();
        container.appendChild(page);
        page.addEventListener('click', function () {
            changePage(i);
        });
    }

    if (currPage + 1 !== maxPages) {
        const next = document.createElement("button");
        next.className = "mdc-button";
        next.innerHTML = "&raquo;";
        container.appendChild(next);
        next.addEventListener('click', function () {
            changePage(currPage + 1);
        });
    }
}

function showCardcastDetailsDialog(code) {
    new CardcastDialog(code).show();
}

function submitSearch() {
    cardcastMenu.cardcastOptionsChanged();
}

function showCardcastMenu() {
    cardcastMenu.show();
}

function changePage(page) {
    _cardcastOffset = DECKS_PER_PAGE * page;
    loadDecks(cardcastMenu.searchQuery,
        cardcastMenu.currentCategories,
        cardcastMenu.nsfwAllowed,
        cardcastMenu.currentSorting);
}