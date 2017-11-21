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

function onLoadPage(event)
{
    /* Load options from local storage */
    
    chrome.storage.local.get(null,
    function(object)
    {
        checkboxes = ["options-autosave",
                      "options-showsubmenu",
                      "options-httpsalso", 
                      "options-notify"];
        for (i = 0; i < checkboxes.length; i++) {
            document.getElementById(checkboxes[i].checked = object[checkboxes[i]]);
        }
    });
    
    /* Add listener for click on show warning checkbox */
    
    document.getElementById("options-autosave").addEventListener("click", onClickAutosave, false);
    
    /* Add listener for click on save button */
    
    document.getElementById("options-save-button").addEventListener("click", onClickSave,false);
}

/* Enable or Disable options */
function onClickAutosave(event)
{
    document.getElementById("options-httpsalso").disabled = !document.getElementById("options-autosave").checked;
}

/* Save options */
function onClickSave(event)
{
    /* Save options to local storage */
    
    chrome.storage.local.set(
    {
        "options-showsubmenu": document.getElementById("options-showsubmenu").checked,
        "options-autosave": document.getElementById("options-autosave").checked,
        "options-httpsalso": document.getElementById("options-httpsalso").checked,
        "options-notify": document.getElementById("options-notify").checked,
    });
    
    /* Display saved status for short period */
    
    document.getElementById("options-save-status").style.setProperty("visibility","visible","");
    
    setTimeout(function()
    {
        document.getElementById("options-save-status").style.setProperty("visibility","hidden","");
    }
    ,1000);
}
