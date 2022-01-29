(function (factory) {
    "use strict"
    if (typeof define === `function` && define.amd) {
        define([`jquery`], factory)
    } else if (typeof exports === `object` && typeof require === `function`) {
        factory(require(`jquery`))
    } else {
        factory(jQuery)
    }
}(function ($) {
    'use strict'

    var utils = (function () {
        return {
            escapeRegExChars: function (value) {
                return value.replace(/[|\\{}()[\]^$+*?.]/g, `\\$&`)
            },
            clearText: function (value) {
                return value.replace(/[^a-zа-яёa-z\s0-9]+/gmui, ` `).replace(/[\s]+/gmui, ` `)
            },
            createNode: function (containerClass) {
                var div = document.createElement(`div`)
                div.className = containerClass
                div.style.position = `absolute`
                div.style.display = `none`
                return div
            }
        }
    }())

    var keys = {
        ESC: 27,
        TAB: 9,
        RETURN: 13,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40
    }

    var noop = $.noop

    function Autocomplete(el, options) {
        var that = this

        that.element = el
        that.el = $(el)
        that.suggestions = []
        that.badQueries = []
        that.selectedIndex = -1
        that.currentValue = that.element.value
        that.timeoutId = null
        that.cachedResponse = {}
        that.onChangeTimeout = null
        that.onChange = null
        that.processContainer = null
        that.suggestionsContainer = null
        that.noSuggestionsContainer = null
        that.wrapperContainer = null
        that.options = $.extend(true, {}, Autocomplete.defaults, options)
        that.classes = {
            selected: `autocomplete-selected`,
            suggestion: `autocomplete-suggestion`
        }
        that.hint = null
        that.hintValue = ``
        that.selection = null

        that.initialize()
        that.setOptions(options)
    }

    Autocomplete.utils = utils

    $.Autocomplete = Autocomplete

    // Значения по умолчанию
    Autocomplete.defaults = {
        autoSelectFirst: false,
        showLogo: true,
        appendTo: `body`,
        addressType: `adm`,
        onSelect: null,
        onHint: null,
        width: `auto`,
        minChars: 2,
        maxHeight: 700,
        deferRequestBy: 0,
        formatResult: _formatResult,
        formatGroup: _formatGroup,
        getGroup: null,
        delimiter: null,
        zIndex: 9999,
        noCache: false,
        onSearchStart: noop,
        onSearchComplete: noop,
        onSearchError: noop,
        preserveInput: false,
        containerClass: `dlt-autocomplete-suggestions`,
        wrapperClass: `dlt-widget`,
        itemsClass: `dlt-autocomplete-items`,
        logoClass: `dlt-logo`,
        inputClass: `dlt-autocomplete-input`,
        tabDisabled: false,
        currentRequest: null,
        triggerSelectOnValidInput: true,
        preventBadQueries: true,
        transformResult: _transformResult,
        showNoSuggestionNotice: true,
        noSuggestionNotice: `<p>Неизвестный&nbsp;адрес.<br>Попробуйте&nbsp;другой.</p>`,
        orientation: `bottom`,
        forceFixPosition: false
    }

    function _transformResult(response) {
        return typeof response === `string` ? $.parseJSON(response) : response
    };

    function _formatResult(suggestion, currentValue) {
        if (!currentValue) {
            return suggestion.address_value
        }

        var stringArr = utils.clearText(currentValue).split(` `)

        return suggestion.address_value
            .replace(new RegExp(`(` + stringArr.join(`|`) + `)`, `gi`), `<strong>$1</strong>`)
            .replace(/&/g, `&amp;`)
            .replace(/</g, `&lt;`)
            .replace(/>/g, `&gt;`)
            .replace(/"/g, `&quot;`)
            .replace(/&lt;(\/?strong)&gt;/g, `<$1>`)
    };

    function _formatGroup(suggestion, category) {
        return `<div class="autocomplete-group">` + category + `</div>`
    };

    Autocomplete.prototype = {

        initialize: function () {
            var that = this
            var suggestionSelector = `.` + that.classes.suggestion
            var selected = that.classes.selected
            var options = that.options
            var container

            that.element.setAttribute(`autocomplete`, `off`)
            that.element.classList.add(options.inputClass);
            var wrapper = document.createElement(`div`);
            wrapper.classList.add(options.wrapperClass);
            $(that.element).wrap($(wrapper))

            var button = document.createElement(`button`);
            var delIcon = document.createElement(`div`);
            var processIcon = document.createElement(`div`);
            button.setAttribute(`title`, `Очистить`)

            delIcon.classList.add('dlt-del');
            processIcon.classList.add('dlt-process-icon');
            button.append(delIcon)
            button.append(processIcon)
            that.wrapperContainer = that.element.parentNode;
            that.wrapperContainer.append(button)

            that.noSuggestionsContainer = $(`<div class="dlt-no-suggestion"></div>`)
                .html(this.options.noSuggestionNotice).get(0)

            that.suggestionsContainer = Autocomplete.utils.createNode(options.containerClass)

            container = $(that.suggestionsContainer)

            var items = document.createElement(`div`);
            items.classList.add(options.itemsClass);
            container.append(items)

            var process = document.createElement(`div`);
            process.classList.add('dlt-process-icon');
            process.innerHTML = '<div></div>'
            container.append(process)
            that.processContainer = $(process);

            if (options.showLogo) {
                var logo = document.createElement(`div`);
                logo.classList.add(options.logoClass);
                logo.innerHTML = '<a href="https://datalitics.ru"><img alt="Даталитикс" src="https://api.datalitics.ru/assets/logo_color_100.png"></a>';
                container.append(logo);
            }

            container.appendTo(options.appendTo || `body`)

            if (options.width !== `auto`) {
                container.css(`width`, options.width)
            }

            container.on(`mouseover.autocomplete`, suggestionSelector, function () {
                that.activate($(this).data(`index`))
            })

            container.on(`mouseout.autocomplete`, function () {
                that.selectedIndex = -1
                container.children(`.` + selected).removeClass(selected)
            })

            container.on(`click.autocomplete`, suggestionSelector, function () {
                that.select($(this).data(`index`))
            })

            container.on(`click.autocomplete`, function () {
                clearTimeout(that.blurTimeoutId)
            })

            that.fixPositionCapture = function () {
                if (that.visible) {
                    that.fixPosition()
                }
            }

            $(window).on(`resize.autocomplete`, that.fixPositionCapture)

            that.checkFilledState();

            that.el.on(`keydown.autocomplete`, function (e) {
                that.checkFilledState();
                that.onKeyPress(e)
            })
            that.el.on(`keyup.autocomplete`, function (e) {
                that.checkFilledState();
                that.onKeyUp(e)
            })
            that.el.on(`blur.autocomplete`, function () {
                that.checkFilledState();
                that.onBlur()
            })
            that.el.on(`focus.autocomplete`, function () {
                that.checkFilledState();
                that.onFocus()
            })
            that.el.on(`change.autocomplete`, function (e) {
                that.checkFilledState();
                that.onKeyUp(e)
            })
            that.el.on(`input.autocomplete`, function (e) {
                that.checkFilledState();
                that.onKeyUp(e)
            })
            $(button).on(`click`, function () {
                that.element.value=''
                that.checkFilledState();
            })
        },

        onFocus: function () {
            var that = this

            if (that.disabled) {
                return
            }

            that.fixPosition()
            if (that.el.val().length >= that.options.minChars) {
                that.onValueChange()
            }
        },

        onBlur: function () {
            var that = this
            var options = that.options
            var value = that.el.val()
            var query = that.getQuery(value)

            that.blurTimeoutId = setTimeout(function () {
                that.containerHide()

                if (that.selection && that.currentValue !== query) {
                    (options.onInvalidateSelection || $.noop).call(that.element)
                }
            }, 200)
        },

        abortAjax: function () {
            var that = this
            if (that.currentRequest) {
                that.currentRequest.abort()
                that.currentRequest = null
            }
        },

        setOptions: function (suppliedOptions) {
            var that = this
            var options = $.extend({}, that.options, suppliedOptions)

            options.orientation = that.validateOrientation(options.orientation, `bottom`)

            $(that.suggestionsContainer).css({
                'max-height': options.maxHeight + `px`,
                width: options.width + `px`,
                'z-index': options.zIndex
            })

            this.options = options
        },

        clearCache: function () {
            this.cachedResponse = {}
            this.badQueries = []
        },

        clear: function () {
            this.clearCache()
            this.currentValue = ``
            this.suggestions = []
        },

        disable: function () {
            var that = this
            that.disabled = true
            clearTimeout(that.onChangeTimeout)
            that.abortAjax()
        },

        enable: function () {
            this.disabled = false
        },

        fixPosition: function () {
            var that = this
            var $container = $(that.suggestionsContainer)
            var containerParent = $container.parent().get(0)

            if (containerParent !== document.body && !that.options.forceFixPosition) {
                return
            }

            var orientation = that.options.orientation
            var containerHeight = $container.outerHeight()
            var height = that.el.outerHeight()
            var offset = that.el.offset()
            var styles = {top: offset.top - 1, left: offset.left}

            if (orientation === `auto`) {
                var viewPortHeight = $(window).height()
                var scrollTop = $(window).scrollTop()
                var topOverflow = -scrollTop + offset.top - containerHeight
                var bottomOverflow = scrollTop + viewPortHeight - (offset.top + height + containerHeight)

                orientation = (Math.max(topOverflow, bottomOverflow) === topOverflow) ? `top` : `bottom`
            }

            if (orientation === `top`) {
                styles.top += -containerHeight
            } else {
                styles.top += height
            }

            if (containerParent !== document.body) {
                var opacity = $container.css(`opacity`)
                var parentOffsetDiff

                if (!that.visible) {
                    $container.css(`opacity`, 0).show()
                }

                parentOffsetDiff = $container.offsetParent().offset()
                styles.top -= parentOffsetDiff.top
                styles.top += containerParent.scrollTop
                styles.left -= parentOffsetDiff.left

                if (!that.visible) {
                    $container.css(`opacity`, opacity).hide()
                }
            }

            if (that.options.width === `auto`) {
                styles.width = that.el.outerWidth() + `px`
            }

            $container.css(styles)
        },

        isCursorAtEnd: function () {
            var that = this
            var valLength = that.el.val().length
            var selectionStart = that.element.selectionStart
            var range

            if (typeof selectionStart === `number`) {
                return selectionStart === valLength
            }
            if (document.selection) {
                range = document.selection.createRange()
                range.moveStart(`character`, -valLength)
                return valLength === range.text.length
            }
            return true
        },

        onKeyPress: function (e) {
            var that = this

            if (!that.disabled && !that.visible && e.which === keys.DOWN && that.currentValue) {
                that.suggest()
                return
            }

            if (that.disabled || !that.visible) {
                return
            }

            switch (e.which) {
                case keys.ESC:
                    that.el.val(that.currentValue)
                    that.containerHide()
                    break
                case keys.RIGHT:
                    if (that.hint && that.options.onHint && that.isCursorAtEnd()) {
                        that.selectHint()
                        break
                    }
                    return
                case keys.TAB:
                    if (that.hint && that.options.onHint) {
                        that.selectHint()
                        return
                    }
                    if (that.selectedIndex === -1) {
                        that.containerHide()
                        return
                    }
                    that.select(that.selectedIndex)
                    if (that.options.tabDisabled === false) {
                        return
                    }
                    break
                case keys.RETURN:
                    if (that.selectedIndex === -1) {
                        that.containerHide()
                        return
                    }
                    that.select(that.selectedIndex)
                    break
                case keys.UP:
                    that.moveUp()
                    break
                case keys.DOWN:
                    that.moveDown()
                    break
                default:
                    return
            }

            e.stopImmediatePropagation()
            e.preventDefault()
        },

        onKeyUp: function (e) {
            var that = this

            if (that.disabled) {
                return
            }

            switch (e.which) {
                case keys.UP:
                case keys.DOWN:
                    return
            }

            clearTimeout(that.onChangeTimeout)

            if (that.currentValue !== that.el.val()) {
                that.findBestHint()
                if (that.options.deferRequestBy > 0) {
                    that.onChangeTimeout = setTimeout(function () {
                        that.onValueChange()
                    }, that.options.deferRequestBy)
                } else {
                    that.onValueChange()
                }
            }
        },

        onValueChange: function () {
            if (this.ignoreValueChange) {
                this.ignoreValueChange = false
                return
            }

            var that = this
            var options = that.options
            var value = that.el.val()
            var query = that.getQuery(value)

            if (that.selection && that.currentValue !== query) {
                that.selection = null;
                (options.onInvalidateSelection || $.noop).call(that.element)
            }

            clearTimeout(that.onChangeTimeout)
            that.currentValue = value
            that.selectedIndex = -1

            if (options.triggerSelectOnValidInput && that.isExactMatch(query)) {
                that.select(0)
                return
            }

            if (query.length < options.minChars) {
                that.containerHide()
            } else {
                that.getSuggestions(query)
            }
        },

        isExactMatch: function (query) {
            var suggestions = this.suggestions

            return (suggestions.length === 1 && suggestions[0].value.toLowerCase() === query.toLowerCase())
        },

        getQuery: function (value) {
            var delimiter = this.options.delimiter
            var parts

            if (!delimiter) {
                return value
            }
            parts = value.split(delimiter)
            return $.trim(parts[parts.length - 1])
        },

        setProcessState: function () {
            var container = $(this.suggestionsContainer)
            var wrapper = $(this.wrapperContainer)
            wrapper.removeClass('filled')
            container.addClass('process')
            wrapper.addClass('process')
        },

        unsetProcessState: function () {
            var container = $(this.suggestionsContainer)
            var wrapper = $(this.wrapperContainer)
            container.removeClass('process')
            wrapper.removeClass('process')
        },

        checkFilledState: function () {
            var wrapper = $(this.wrapperContainer)
            var value = this.element.value

            if (!$(wrapper).hasClass('process')) {
                if (value !== '' && value !== undefined) {
                    wrapper.addClass('filled')
                } else {
                    wrapper.removeClass('filled')
                }
            }
        },

        getSuggestions: function (q) {
            var response
            var that = this
            var options = that.options
            var serviceUrl = `https://api.datalitics.ru/v1/address/` + options.addressType + `/suggest`
            var params = {}
            var cacheKey

            params.q = q

            if (options.onSearchStart.call(that.element, params) === false) {
                return
            }

            cacheKey = serviceUrl + `?` + $.param(params || {})
            response = that.cachedResponse[cacheKey]

            if (response && Array.isArray(response)) {
                that.suggestions = response
                that.suggest()
                options.onSearchComplete.call(that.element, q, that.suggestions)
            } else if (!that.isBadQuery(q)) {
                that.abortAjax()
                that.setProcessState()
                that.currentRequest = $.ajax({
                    url: serviceUrl,
                    data: params,
                    type: `GET`,
                    dataType: `text`
                }).done(function (data) {
                    var result
                    that.currentRequest = null
                    result = options.transformResult(data, q)
                    that.processResponse(result, q, cacheKey)
                    options.onSearchComplete.call(that.element, q, result.suggestions)
                    that.unsetProcessState()
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    options.onSearchError.call(that.element, q, jqXHR, textStatus, errorThrown)
                    that.unsetProcessState()
                })
            } else {
                this.noSuggestions()
                options.onSearchComplete.call(that.element, q, [])
            }
        },

        isBadQuery: function (q) {
            if (!this.options.preventBadQueries) {
                return false
            }

            var badQueries = this.badQueries
            var i = badQueries.length

            while (i--) {
                if (q.indexOf(badQueries[i]) === 0) {
                    return true
                }
            }

            return false
        },

        containerShow: function () {
            var container = $(this.suggestionsContainer)
            container.show()
            container.addClass('active')
            this.el.addClass('active')
            this.visible = true
        },

        containerHide: function () {
            var that = this
            var container = $(that.suggestionsContainer)

            if ($.isFunction(that.options.onHide) && that.visible) {
                that.options.onHide.call(that.element, container)
            }

            that.visible = false
            that.selectedIndex = -1
            clearTimeout(that.onChangeTimeout)
            container.hide()
            that.onHint(null)
            container.removeClass('active')
            this.el.removeClass('active')
        },

        suggest: function () {
            if (!this.suggestions.length) {
                if (this.options.showNoSuggestionNotice) {
                    this.noSuggestions()
                } else {
                    this.containerHide()
                }
                return
            }

            var that = this
            var options = that.options
            var formatResult = options.formatResult
            var value = that.getQuery(that.currentValue)
            var className = that.classes.suggestion
            var classSelected = that.classes.selected
            var container = $(that.suggestionsContainer)
            var noSuggestionsContainer = $(that.noSuggestionsContainer)
            var beforeRender = options.beforeRender
            var html = ``
            var category
            var formatGroup = function (suggestion, index) {
                var currentCategory = options.getGroup(suggestion, index)

                if (category === currentCategory) {
                    return ``
                }

                category = currentCategory

                return options.formatGroup(suggestion, category)
            }

            if (options.triggerSelectOnValidInput && that.isExactMatch(value)) {
                that.select(0)
                return
            }

            $.each(that.suggestions, function (i, suggestion) {
                if ($.isFunction(options.getGroup)) {
                    html += formatGroup(suggestion, value, i)
                }

                html += `<div class="` + className + `" title="` + suggestion.address_value + `" data-index="` + i + `"><address>` + formatResult(suggestion, value, i) + `</address></div>`
            })

            this.adjustContainerWidth()

            noSuggestionsContainer.detach()
            container.find(`.` + options.itemsClass).html(html)

            if ($.isFunction(beforeRender)) {
                beforeRender.call(that.element, container, that.suggestions)
            }
            that.fixPosition()

            that.containerShow()

            if (options.autoSelectFirst) {
                that.selectedIndex = 0
                container.scrollTop(0)
                container.children(`.` + className).first().addClass(classSelected)
            }


            that.findBestHint()
        },

        noSuggestions: function () {
            var that = this
            var options = that.options
            var beforeRender = options.beforeRender
            var container = $(that.suggestionsContainer)
            var noSuggestionsContainer = $(that.noSuggestionsContainer)

            this.adjustContainerWidth()

            noSuggestionsContainer.detach()
            container.find(`.` + options.itemsClass).empty()
            container.prepend(noSuggestionsContainer)

            if ($.isFunction(beforeRender)) {
                beforeRender.call(that.element, container, that.suggestions)
            }

            that.fixPosition()
            this.containerShow()
        },

        adjustContainerWidth: function () {
            var that = this
            var options = that.options
            var width
            var container = $(that.suggestionsContainer)

            if (options.width === `auto`) {
                width = that.el.outerWidth()
                container.css(`width`, width > 0 ? width : 300)
            } else if (options.width === `flex`) {
                container.css(`width`, ``)
            }
        },

        findBestHint: function () {
            var that = this
            var value = that.el.val().toLowerCase()
            var bestMatch = null

            if (!value) {
                return
            }

            $.each(that.suggestions, function (i, suggestion) {
                var foundMatch = suggestion.address_value.toLowerCase().indexOf(value) === 0
                if (foundMatch) {
                    bestMatch = suggestion
                }
                return !foundMatch
            })

            that.onHint(bestMatch)
        },

        onHint: function (suggestion) {
            var that = this
            var onHintCallback = that.options.onHint
            var hintValue = ``

            if (suggestion) {
                hintValue = that.currentValue + suggestion.address_value.substr(that.currentValue.length)
            }
            if (that.hintValue !== hintValue) {
                that.hintValue = hintValue
                that.hint = suggestion
                if ($.isFunction(onHintCallback)) {
                    onHintCallback.call(that.element, hintValue)
                }
            }
        },

        verifySuggestionsFormat: function (suggestions) {
            if (suggestions.length && typeof suggestions[0] === `string`) {
                return $.map(suggestions, function (value) {
                    return {value: value, data: null}
                })
            }

            return suggestions
        },

        validateOrientation: function (orientation, fallback) {
            orientation = $.trim(orientation || ``).toLowerCase()

            if ($.inArray(orientation, [`auto`, `bottom`, `top`]) === -1) {
                orientation = fallback
            }

            return orientation
        },

        processResponse: function (result, originalQuery, cacheKey) {
            var that = this
            var items = []
            var options = that.options

            items = result.data ? result.data.items : []

            items = that.verifySuggestionsFormat(items)

            if (!options.noCache) {
                that.cachedResponse[cacheKey] = items
                if (options.preventBadQueries && !items.length) {
                    that.badQueries.push(originalQuery)
                }
            }

            if (originalQuery !== that.getQuery(that.currentValue)) {
                return
            }

            that.suggestions = items
            that.suggest()
        },

        activate: function (index) {
            var that = this
            var activeItem
            var selected = that.classes.selected
            var container = $(that.suggestionsContainer)
            var children = container.find(`.` + that.classes.suggestion)

            container.find(`.` + selected).removeClass(selected)

            that.selectedIndex = index

            if (that.selectedIndex !== -1 && children.length > that.selectedIndex) {
                activeItem = children.get(that.selectedIndex)
                $(activeItem).addClass(selected)
                return activeItem
            }

            return null
        },

        selectHint: function () {
            var that = this
            var i = $.inArray(that.hint, that.suggestions)

            that.select(i)
        },

        select: function (i) {
            var that = this
            that.containerHide()
            that.onSelect(i)
        },

        moveUp: function () {
            var that = this

            if (that.selectedIndex === -1) {
                return
            }

            if (that.selectedIndex === 0) {
                $(that.suggestionsContainer).children(`.` + that.classes.suggestion).first().removeClass(that.classes.selected)
                that.selectedIndex = -1
                that.ignoreValueChange = false
                that.el.val(that.currentValue)
                that.findBestHint()
                return
            }

            that.adjustScroll(that.selectedIndex - 1)
        },

        moveDown: function () {
            var that = this

            if (that.selectedIndex === (that.suggestions.length - 1)) {
                return
            }

            that.adjustScroll(that.selectedIndex + 1)
        },

        adjustScroll: function (index) {
            var that = this
            var activeItem = that.activate(index)

            if (!activeItem) {
                return
            }

            var offsetTop
            var upperBound
            var lowerBound
            var heightDelta = $(activeItem).outerHeight()

            offsetTop = activeItem.offsetTop
            upperBound = $(that.suggestionsContainer).scrollTop()
            lowerBound = upperBound + that.options.maxHeight - heightDelta

            if (offsetTop < upperBound) {
                $(that.suggestionsContainer).scrollTop(offsetTop)
            } else if (offsetTop > lowerBound) {
                $(that.suggestionsContainer).scrollTop(offsetTop - that.options.maxHeight + heightDelta)
            }

            if (!that.options.preserveInput) {
                that.ignoreValueChange = true
                that.el.val(that.getValue(that.suggestions[index].value))
            }

            that.onHint(null)
        },

        onSelect: function (index) {
            var that = this
            var onSelectCallback = that.options.onSelect
            var suggestion = that.suggestions[index]

            that.currentValue = that.getValue(suggestion.address_value)

            if (that.currentValue !== that.el.val() && !that.options.preserveInput) {
                that.el.val(that.currentValue)
            }

            that.onHint(null)
            that.suggestions = []
            that.selection = suggestion

            if ($.isFunction(onSelectCallback)) {
                onSelectCallback.call(that.element, suggestion)
            }
        },

        getValue: function (value) {
            var that = this
            var delimiter = that.options.delimiter
            var currentValue
            var parts

            if (!delimiter) {
                return value
            }

            currentValue = that.currentValue
            parts = currentValue.split(delimiter)

            if (parts.length === 1) {
                return value
            }

            return currentValue.substr(0, currentValue.length - parts[parts.length - 1].length) + value
        },

        dispose: function () {
            var that = this
            that.el.off(`.autocomplete`).removeData(`autocomplete`)
            $(window).off(`resize.autocomplete`, that.fixPositionCapture)
            $(that.suggestionsContainer).remove()
        }
    }

    $.fn.devbridgeAutocomplete = function (options, args) {
        var dataKey = `autocomplete`
        if (!arguments.length) {
            return this.first().data(dataKey)
        }

        return this.each(function () {
            var inputElement = $(this)
            var instance = inputElement.data(dataKey)

            if (typeof options === `string`) {
                if (instance && typeof instance[options] === `function`) {
                    instance[options](args)
                }
            } else {
                if (instance && instance.dispose) {
                    instance.dispose()
                }
                instance = new Autocomplete(this, options)
                inputElement.data(dataKey, instance)
            }
        })
    }

    if (!$.fn.autocomplete) {
        $.fn.autocomplete = $.fn.devbridgeAutocomplete
    }
}))
