/*
 *      RecollWebext - WebExtension - Background Page
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

/* Global variables */

var isFirefox;

var menuAction;
var iconFound;
var autosave;
var httpsalso;

var htmlStrings = new Array();

/* Initialize on script load */
chrome.storage.local.get(
    null,
    function(object)
    {
        /* Load environment */
        isFirefox = object["environment-isfirefox"];
    
        /* Load options */
        autosave = object["options-autosave"];
        httpsalso = object["options-httpsalso"];
        
        addListeners();
});

/************************************************************************/

console.log("SAVEPAGE: window.addEventListener(load)");


/* Add listeners */

function addListeners()
{
    window.addEventListener(
        "load",
        function(event)
        {
            console.log("SAVEPAGE: document.readyState " + document.readyState);
            if (document.readyState == "complete")
                maybeSave();
        }, false);
    
    /* Storage changed listener */
    chrome.storage.onChanged.addListener(
    function(changes,areaName)
    {
        chrome.storage.local.get(null,
        function(object)
        {
            autosave = object["options-autosave"];
            httpsalso = object["options-httpsalso"];
        });
    });
    
    /* Message received listener */
    chrome.runtime.onMessage.addListener(
        function(message,sender,sendResponse)
        {
            var panel;
        
        switch (message.type) {
            /* Messages from background page */
            case "performAction":
            /* to confirm content script has been loaded */
            sendResponse({ });
                
            menuAction = message.menuaction;
                
            /* Wait for page to complete loading */
            if (document.readyState == "complete") {
                window.setTimeout(
                    function()
                    {
                        performAction(message.srcurl);
                    }, 50);
                } else {
                    window.addEventListener(
                        "load",
                        function(event)
                        {
                            if (document.readyState == "complete")
                                performAction(message.srcurl);
                        }, false);
                }
                
                break;
                
            case "loadSuccess":
            loadSuccess(message.index, message.content,
                        message.contenttype, message.alloworigin);
            break;
                
            case "loadFailure":
            loadFailure(message.index);
            break;
        }
    });
}

function performAction(srcurl)
{
    if (menuAction == 0) {
        /* Save page */
        htmlStrings.length = 0;
        htmlStrings[0] = "﻿";  /* UTF-8 Byte Order Mark (BOM) - 0xEF 0xBB 0xBF */
        maybeSave();
    }
}

function maybeSave()
{
    console.log("SAVEPAGE: maybeSave. mtype " + document.contentType +
                " url " + document.location.href);
    chrome.runtime.sendMessage({type: "setSaveBadge", text: "SAVE",
                                color: "#E00000" });
    generateHTML();
}

function generateHTML()
{
    var i,j,mimetype,charset,htmlBlob,objectURL,documentURL;
    var filename,datestr,link;
    var pathsegments = new Array();
    var date = new Date();

    console.log("SAVEPAGE: generateHTML");
    
    chrome.runtime.sendMessage({ type: "setSaveBadge", text: "SAVE", color: "#0000E0" });
    
    /* Save to file using HTML5 download attribute */
    htmlStrings.length = 0;
    htmlStrings[0] = document.documentElement.outerHTML;
    htmlBlob = new Blob(htmlStrings, { type: "text/x-recoll-html" });    
    objectURL = window.URL.createObjectURL(htmlBlob);
    htmlStrings.length = 0;
    
    documentURL = new URL(document.baseURI,"about:blank");

    /* Generate file name */
    if (document.title == "") {
        pathsegments = documentURL.pathname.split("/");
        filename = pathsegments.pop();
        if (filename == "") filename = pathsegments.pop();
        
        filename = decodeURIComponent(filename);
        
        i = filename.lastIndexOf(".");
        if (i < 0) {
            filename = filename + ".html";
        } else {
            filename = filename.substring(0,i) + ".html";
        }
    } else {
        filename = document.title + ".html";
    }
    
    link = document.createElement("a");
    link.download = filename;
    if(document.contentType.match(/(text|html|xml)/i)) {
        if(document.contentType.match(/(pdf)/i)) {
            /* Does not work: get WebExtensions context not found */
            link.href = document.location.href;
        } else {
            link.href = objectURL;
        }
        console.log("SAVEPAGE: link.href is " + link.href);
        document.body.appendChild(link);
        link.addEventListener("click",handleClick,true);
        link.click();  /* save page as .html file */
        link.removeEventListener("click",handleClick,true);
        console.log("SAVEPAGE: clicked link");
        chrome.runtime.sendMessage({type: "downloadFile",
                                    location: document.location.href,
                                    filename: filename});
        window.setTimeout(
            function()
            {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(objectURL);
                chrome.runtime.sendMessage({type: "setSaveBadge",
                                            text: "", color: "#000000" });
            }, 100);
        function handleClick(event)
        {
            event.stopPropagation();
        }
    } else {
        if (1) {
            console.log("SAVEPAGE: send download message for " +
                        document.location.href + " filename " + filename);
            chrome.runtime.sendMessage({type: "downloadFile",
                                        location: document.location.href,
                                        filename: filename });
        } else {
            resourceLocation[0] = document.location.href;
            console.log("SAVEPAGE: sendMessage loadResource for " +
                        resourceLocation[0]);
            chrome.runtime.sendMessage({type: "loadResource",
                                        index: 0, location: resourceLocation[0],
                                        pagescheme: documentURL.protocol});
        }
    }
}
