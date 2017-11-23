/*
 *      RecollWebext - WebExtension - Options page
 *
 *      A lot of code was copied from or inspired by the savepage-WE
 *      extension.
 *
 *      Copyright (C) 2017 jfd@recoll.org
 *      Copyright (C) 2016-2017 DW-dev
 *
 *      Distributed under the GNU General Public License version 2
 *      See LICENCE.txt file and http://www.gnu.org/licenses/
 */

"use strict";

/* Listener for options page load */

document.addEventListener("DOMContentLoaded", onLoadPage, false);

var urlRules = {
    inc: [],
    exc: []
};

var urlExcludeRules = [];

function onLoadPage(event)
{
    /* Load options from local storage */
    console.log("ONLOADPAGE");
    chrome.storage.local.get(null,
    function(object) {
        var i, t;
        var checkboxes = ["options-autosave",
                          "options-showsubmenu",
                          "options-httpsalso", 
                          "options-notify"];
        for (i = 0; i < checkboxes.length; i++) {
            console.log(checkboxes[i] + " will be " + object[checkboxes[i]]);
            document.getElementById(checkboxes[i]).checked =
                object[checkboxes[i]];
        }
        var keys = ["options-url-include", "options-url-exclude"];
        var sks = ["inc", "exc"];
        for (t = 0; t < 2; t++) {
            var key = keys[t];
            var sk = sks[t];
            if (key in object) {
                for (i = 0; i < object[key].length; i++) {
                    urlRules[sk].push(object[key][i]);
                }
            }
        }
        updateRulesTables();
    });

    document.getElementById("include-button-add").addEventListener(
        "click", onClickIncludeAdd, false);
    document.getElementById("include-button-delete").addEventListener(
        "click", onClickIncludeDelete, false);
    document.getElementById("exclude-button-add").addEventListener(
        "click", onClickExcludeAdd, false);
    document.getElementById("exclude-button-delete").addEventListener(
        "click", onClickExcludeDelete, false);

    document.getElementById("options-autosave").addEventListener(
        "click", onClickAutosave, false);
    
    document.getElementById("options-save-button").addEventListener(
        "click", onClickSave, false);

    document.removeEventListener("DOMContentLoaded", onLoadPage, false);
}

function updateRulesTables()
{
    var i, t;
    var caption = "Include rules";
    var keys = ["options-url-include", "options-url-exclude"];
    var sks = ["inc", "exc"];
    for (t = 0; t < 2; t++) {
        var key = keys[t];
        var sk = sks[t];
        var html = '<caption>' + caption + '</caption>\n' +
            '<tr><th>' + 
            '<input id="ckb-' + sk + '-all" type="checkbox"/>' +
            '</th><th>Name</th><th>Pattern</th>' +
            '<th>PatternType</th></tr>';
        for (i = 0; i < urlRules[sk].length; i++) {
            html += '<tr><td>'+
                '<input id="ckb-' + sk + '-' + i + '" type="checkbox"/>' +
                '</td>';
            html += '<td>' + urlRules[sk][i][0] + '</td>';
            html += '<td>' + urlRules[sk][i][1] + '</td>';
            html += '<td>' + urlRules[sk][i][2] + '</td></tr>';
        }
        if (urlRules[sk].length == 0) {
            html += '<tr><td>'+
                '<input id="ckb-' + sk + '-0" type="checkbox"/></td>';
            html += '<td> </td><td> </td><td> </td></tr>';
        }
        console.log("Elt for key "+key + " is " + document.getElementById(key));
        console.log("html is " + html);
        document.getElementById(key).innerHTML = html;
        caption = "Exclude rules";
    }

    document.getElementById("ckb-inc-all").addEventListener(
        "click",  onClickIncludeSelectAll, false);
    document.getElementById("ckb-exc-all").addEventListener(
        "click",  onClickExcludeSelectAll, false);
}

function onClickRuleAdd(key, sk)
{
    var name = document.getElementById(key + "-input-name").value;
    var val = document.getElementById(key + "-input-value").value;
    var tp = document.getElementById(key + "-select-type").value;
    console.log('onClickRuleAdd: urlRules['+ sk +'].push(['+ name + ', ' + val +
                ', ' + tp + '])')
    urlRules[sk].push([name, val, tp]);
    onClickSave();
}
function onClickRuleDelete(sk)
{
    var i;
    var newlist = [];
    for (i = 0; i < urlRules[sk].length; i++) {
        var id = 'ckb-' + sk + '-' + i;
        if (! document.getElementById(id).checked) {
            newlist.push(urlRules[sk][i]);
        }
    }
    urlRules[sk] = newlist;
    onClickSave();
}
function onClickRuleSelectAll(sk)
{
    var i;
    var ck = document.getElementById('ckb-' + sk + '-all').checked;
    for (i = 0; i < urlRules[sk].length; i++) {
        document.getElementById('ckb-' + sk + '-' + i).checked = ck;
    }
}

function onClickIncludeAdd(event)
{
    onClickRuleAdd('include', 'inc');
}
function onClickIncludeDelete(event)
{
    onClickRuleDelete('inc');
}
function onClickIncludeSelectAll(event)
{
    onClickRuleSelectAll('inc');
}
function onClickExcludeAdd(event)
{
    onClickRuleAdd('exclude', 'exc');
}
function onClickExcludeDelete(event)
{
    onClickRuleDelete('exc');
}
function onClickExcludeSelectAll(event)
{
    onClickRuleSelectAll('exc');
}

/* Enable or Disable options */
function onClickAutosave(event)
{
    document.getElementById("options-httpsalso").disabled =
        !document.getElementById("options-autosave").checked;
}

/* Save options */
function onClickSave(event)
{
    var checkboxnames = ["options-autosave",
                         "options-showsubmenu",
                         "options-httpsalso", 
                         "options-notify"];
    var i, t;
    var opts = {};
    
    for (i = 0; i < checkboxnames.length; i++) {
        opts[checkboxnames[i]] =
            document.getElementById(checkboxnames[i]).checked;
    }
    var keys = ["options-url-include", "options-url-exclude"];
    var sks = ["inc", "exc"];
    for (t = 0; t < 2; t++) {
        var key = keys[t];
        var sk = sks[t];
        opts[key] = [];
        for (i = 0; i < urlRules[sk].length; i++) {
            opts[key].push(urlRules[sk][i]);
        }
    }
    
    chrome.storage.local.set(opts);
    
    /* Display saved status for short period */
    document.getElementById("options-save-status").style.setProperty(
        "visibility", "visible", "");
    
    setTimeout(function() {
        document.getElementById("options-save-status").style.setProperty(
            "visibility", "hidden", "");
    }, 1000);
}
