/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Content Pages             */
/*                                                                      */
/*      Javascript for Content Pages                                    */
/*                                                                      */
/*      Last Edit - 27 Oct 2017                                         */
/*                                                                      */
/*      Copyright (C) 2016-2017 DW-dev                                  */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Refer to Google Chrome developer documentation:                      */
/*                                                                      */
/*  https://developer.chrome.com/extensions/content_scripts             */
/*  https://developer.chrome.com/extensions/messaging                   */
/*  https://developer.chrome.com/extensions/xhr                         */
/*                                                                      */
/*  https://developer.chrome.com/extensions/match_patterns              */
/*                                                                      */
/*  https://developer.chrome.com/extensions/extension                   */
/*  https://developer.chrome.com/extensions/runtime                     */
/*  https://developer.chrome.com/extensions/storage                     */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables */

var isFirefox;

var showWarning,showURLList,prefixFileName,suffixFileName;
var saveHTMLAudioVideo,saveHTMLObjectEmbed,saveHTMLImagesAll;
var saveCSSImagesAll,saveCSSFontsWoff,saveScripts;
var usePageLoader,removeUnsavedURLs,includeInfoBar,includeSummary;
var maxFrameDepth;
var maxResourceSize;

var savedPage;  /* page was saved by Save Page WE */
var savedPageLoader;  /* page contains page loader script */

var menuAction;
var passNumber;
var iconFound;

var resourceCount;

var resourceLocation = new Array();
var resourceMimeType = new Array();
var resourceCharSet = new Array();
var resourceContent = new Array();
var resourceStatus = new Array();
var resourceRemembered = new Array();
var resourceReplaced = new Array();

var htmlStrings = new Array();

var timeStart = new Array();
var timeFinish = new Array();

var pageLoader;

/************************************************************************/

/* Initialize on script load */

chrome.storage.local.get(null,
function(object)
{
    /* Load environment */
    
    isFirefox = object["environment-isfirefox"];
    
    /* Load options */
    
    showWarning = object["options-showwarning"];
    showURLList = object["options-showurllist"];
    prefixFileName = object["options-prefixfilename"];
    suffixFileName = object["options-suffixfilename"];
    
    saveHTMLAudioVideo = object["options-savehtmlaudiovideo"];
    saveHTMLObjectEmbed = object["options-savehtmlobjectembed"];
    saveHTMLImagesAll = object["options-savehtmlimagesall"];
    saveCSSImagesAll = object["options-savecssimagesall"];
    saveCSSFontsWoff = object["options-savecssfontswoff"];
    saveScripts = object["options-savescripts"];
    
    usePageLoader = object["options-usepageloader"];
    removeUnsavedURLs = object["options-removeunsavedurls"];
    includeInfoBar = object["options-includeinfobar"];
    includeSummary = object["options-includesummary"];
    
    maxFrameDepth = object["options-maxframedepth"];
    
    maxResourceSize = object["options-maxresourcesize"];
    
    /* Set saved page flags */
    
    savedPage = (document.head.querySelector("meta[name='savepage-url']") != null);
    
    savedPageLoader = (document.head.querySelector("script[id='savepage-pageloader']") != null);
    
    /* Add listeners */
    
    addListeners();
});

/************************************************************************/

console.log("SAVEPAGE: window.addEventListener(load)");

window.addEventListener("load",
                        function(event)
                        {
                            console.log("SAVEPAGE: document.readyState " + document.readyState);
                            if (document.readyState == "complete") gatherStyleSheets();
                        },false);

/* Add listeners */

function addListeners()
{
    /* Storage changed listener */
    
    chrome.storage.onChanged.addListener(
    function(changes,areaName)
    {
        chrome.storage.local.get(null,
        function(object)
        {
            showWarning = object["options-showwarning"];
            showURLList = object["options-showurllist"];
            prefixFileName = object["options-prefixfilename"];
            suffixFileName = object["options-suffixfilename"];
            
            saveHTMLAudioVideo = object["options-savehtmlaudiovideo"];
            saveHTMLObjectEmbed = object["options-savehtmlobjectembed"];
            saveHTMLImagesAll = object["options-savehtmlimagesall"];
            saveCSSImagesAll = object["options-savecssimagesall"];
            saveCSSFontsWoff = object["options-savecssfontswoff"];
            saveScripts = object["options-savescripts"];
            
            usePageLoader = object["options-usepageloader"];
            removeUnsavedURLs = object["options-removeunsavedurls"];
            includeInfoBar = object["options-includeinfobar"];
            includeSummary = object["options-includesummary"];
            
            maxFrameDepth = object["options-maxframedepth"];
            
            maxResourceSize = object["options-maxresourcesize"];
        });
    });
    
    /* Message received listener */
    
    chrome.runtime.onMessage.addListener(
    function(message,sender,sendResponse)
    {
        var panel;
        
        switch (message.type)
        {
            /* Messages from background page */
            
            case "performAction":

                sendResponse({ });  /* to confirm content script has been loaded */
                
                menuAction = message.menuaction;
                
                /* Close page info panel if open */
                
                panel = document.getElementById("savepage-pageinfo-container");
                
                if (panel != null) document.body.removeChild(panel);
                
                /* Wait for page to complete loading */
                
                if (document.readyState == "complete")
                {
                    window.setTimeout(
                    function()
                    {
                        performAction(message.srcurl);
                    },50);
                }
                else
                {
                    window.addEventListener("load",
                    function(event)
                    {
                        if (document.readyState == "complete") performAction(message.srcurl);
                    },false);
                }
                
                break;
                
            case "loadSuccess":
                
                loadSuccess(message.index,message.content,message.contenttype,message.alloworigin);
                
                break;
                
            case "loadFailure":
                
                loadFailure(message.index);
                
                break;
        }
    });
}

/************************************************************************/

/* Perform action function */

function performAction(srcurl)
{
    var script;

    if (menuAction <= 2)  /* save page */
    {
        if (!savedPageLoader)
        {            
            /* Initialize resources */
            
            resourceLocation.length = 0;
            resourceMimeType.length = 0;
            resourceCharSet.length = 0;
            resourceContent.length = 0;
            resourceStatus.length = 0;
            resourceRemembered.length = 0;
            resourceReplaced.length = 0;
            
            htmlStrings.length = 0;
            
            htmlStrings[0] = "﻿";  /* UTF-8 Byte Order Mark (BOM) - 0xEF 0xBB 0xBF */
            
            gatherStyleSheets();
        }
        else alert("This page was loaded using page loader.\n\nCannot perform operation.");
    }
    else if (menuAction == 3)  /* view saved page info */
    {
        if (savedPage) viewSavedPageInfo();
        else alert("This page was not saved by Save Page WE.\n\nCannot perform operation.");
    }
    else if (menuAction == 4)  /* remove page loader */
    {
        if (savedPage)
        {
            if (savedPageLoader) removePageLoader();
            else alert("This page was not loaded using page loader.\n\nCannot perform operation.");
        }
        else alert("This page was not saved by Save Page WE.\n\nCannot perform operation.");
    }
    else if (menuAction == 5)  /* extract saved page media (image/audio/video) */
    {
        if (savedPage) extractSavedPageMedia(srcurl);
        else alert("This page was not saved by Save Page WE.\n\nCannot perform operation.");
    }
}

/************************************************************************/

/* First Pass - to find external style sheets and load into arrays */

function gatherStyleSheets()
{
    console.log("SAVEPAGE: gatherStyleSheets. Content type " + document.contentType + " url " + document.location.href);
    passNumber = 1;
    
    chrome.runtime.sendMessage({ type: "setSaveBadge", text: "SAVE", color: "#E00000" });
    
    timeStart[1] = performance.now();
    
/*    findStyleSheets(0,window,document.documentElement);*/
    
    timeFinish[1] = performance.now();
    
    loadResources();
}

function findStyleSheets(depth,frame,element)
{
    var i,baseuri,charset,csstext,regex;
    var matches = new Array();
    
    /* External style sheet imported in <style> element */
    
    if (element.localName == "style")
    {
        csstext = element.textContent;
        
        baseuri = element.ownerDocument.baseURI;
        
        charset = element.ownerDocument.characterSet;
        
        regex = /@import\s*(?:url\(\s*)?(?:'|")?(?!data:)([^\s'";)]+)(?:'|")?(?:\s*\))?\s*;/gi;  /* @import url() excluding existing data uri */
        
        while ((matches = regex.exec(csstext)) != null)
        {
            rememberURL(matches[1],baseuri,"text/css",charset);
        }
    }
    
    /* External style sheet referenced in <link> element */
    
    else if (element.localName == "link")
    {
        if (element.rel.toLowerCase() == "stylesheet" && element.getAttribute("href") != "" && element.href != "")    /* href attribute and property may be different */
        {
            if (element.href.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                if (element.charset != "") charset = element.charset;
                else charset = element.ownerDocument.characterSet;
                
                rememberURL(element.href,baseuri,"text/css",charset);
            }
        }
    }
    
    /* Handle nested frames and child elements */
    
    if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
    {
        try
        {
            if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before finding */
            {
                if (depth < maxFrameDepth)
                {
                    findStyleSheets(depth+1,element.contentWindow,element.contentDocument.documentElement);
                }
            }
        }
        catch (e) {}  /* attempting cross-domain web page access */
    }
    else
    {
        for (i = 0; i < element.children.length; i++)
            if (element.children[i] != null)  /* in case web page not fully loaded before finding */
                findStyleSheets(depth,frame,element.children[i]);
    }
}

/************************************************************************/

/* Second Pass - to find other external resources and load into arrays */

function gatherOtherResources()
{
    passNumber = 2;
    
    iconFound = false;
    
    chrome.runtime.sendMessage({ type: "setSaveBadge", text: "SAVE", color: "#A000D0" });
    
    timeStart[2] = performance.now();
    
    findOtherResources(0,window,document.documentElement);
    
    timeFinish[2] = performance.now();
    
    loadResources();
}

function findOtherResources(depth,frame,element)
{
    var i,j,style,displayed,baseuri,charset,csstext,regex,location;
    var matches = new Array();
    
    style = frame.getComputedStyle(element);
    
    displayed = (style != null && style.getPropertyValue("display") != "none");
    
    /* External images referenced in any element's computed style */
    
    if ((menuAction == 2 || (menuAction == 1 && !saveCSSImagesAll) || menuAction == 0) && displayed)
    {
        csstext = "";
        
        csstext += style.getPropertyValue("background-image") + " ";
        csstext += style.getPropertyValue("border-image-source") + " ";
        csstext += style.getPropertyValue("list-style-image") + " ";
        csstext += style.getPropertyValue("cursor") + " ";
        csstext += style.getPropertyValue("filter") + " ";
        csstext += style.getPropertyValue("clip-path") + " ";
        csstext += style.getPropertyValue("mask") + " ";
        
        style = frame.getComputedStyle(element,"before");
        csstext += style.getPropertyValue("background-image") + " ";
        csstext += style.getPropertyValue("border-image-source") + " ";
        csstext += style.getPropertyValue("list-style-image") + " ";
        csstext += style.getPropertyValue("cursor") + " ";
        csstext += style.getPropertyValue("content") + " ";
        csstext += style.getPropertyValue("filter") + " ";
        csstext += style.getPropertyValue("clip-path") + " ";
        csstext += style.getPropertyValue("mask") + " ";
        
        style = frame.getComputedStyle(element,"after");
        csstext += style.getPropertyValue("background-image") + " ";
        csstext += style.getPropertyValue("border-image-source") + " ";
        csstext += style.getPropertyValue("list-style-image") + " ";
        csstext += style.getPropertyValue("cursor") + " ";
        csstext += style.getPropertyValue("content") + " ";
        csstext += style.getPropertyValue("filter") + " ";
        csstext += style.getPropertyValue("clip-path") + " ";
        csstext += style.getPropertyValue("mask") + " ";
        
        style = frame.getComputedStyle(element,"first-letter");
        csstext += style.getPropertyValue("background-image") + " ";
        csstext += style.getPropertyValue("border-image-source") + " ";
        
        style = frame.getComputedStyle(element,"first-line");
        csstext += style.getPropertyValue("background-image") + " ";
        
        baseuri = element.ownerDocument.baseURI;
        
        regex = /url\(\s*(?:'|")?(?!data:)([^\s'")]+)(?:'|")?\s*\)/gi;  /* image url() excluding existing data uri */
        
        while ((matches = regex.exec(csstext)) != null)
        {
            rememberURL(matches[1],baseuri,"image/png","");
        }
    }
    
    /* External images referenced in any element's style attribute */
    
    if (element.hasAttribute("style"))
    {
        if (menuAction == 1 && saveCSSImagesAll)
        {
            csstext = element.getAttribute("style");
            
            baseuri = element.ownerDocument.baseURI;
            
            regex = /url\(\s*(?:'|")?(?!data:)([^\s'")]+)(?:'|")?\s*\)/gi;  /* image url() excluding existing data uri */
            
            while ((matches = regex.exec(csstext)) != null)
            {
                rememberURL(matches[1],baseuri,"image/png","");
            }
        }
    }
    
    /* External script referenced in <script> element */
    
    if (element.localName == "script")
    {
        if (element.src != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveScripts))
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    if (element.charset != "") charset = element.charset;
                    else charset = element.ownerDocument.characterSet;
                    
                    rememberURL(element.src,baseuri,"application/javascript",charset);
                }
            }
        }
    }
    
    /* External images or fonts referenced in <style> element */
    
    else if (element.localName == "style")
    {
        csstext = element.textContent;
        
        baseuri = element.ownerDocument.baseURI;
        
        findCSSURLsInStyleSheet(csstext,baseuri);
    }
    
    /* External images or fonts referenced in <link> element */
    /* External icon referenced in <link> element */
    
    else if (element.localName == "link")
    {
        if (element.rel.toLowerCase() == "stylesheet" && element.getAttribute("href") != "" && element.href != "")    /* href attribute and property may be different */
        {
            if (element.href.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                if (baseuri != null)
                {
                    location = resolveURL(element.href,baseuri);
                    
                    if (location != null)
                    {
                        for (i = 0; i < resourceLocation.length; i++)
                            if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
                        
                        if (i < resourceLocation.length)  /* style sheet found */
                        {
                            csstext = resourceContent[i];
                            
                            baseuri = element.href;
                            
                            findCSSURLsInStyleSheet(csstext,baseuri);
                        }
                    }
                }
            }
        }
        else if ((element.rel.toLowerCase() == "icon" || element.rel.toLowerCase() == "shortcut icon") && element.href != "")
        {
            iconFound = true;
            
            baseuri = element.ownerDocument.baseURI;
            
            rememberURL(element.href,baseuri,"image/vnd.microsoft.icon","");
        }
    }
    
    /* External image referenced in <body> element */
    
    else if (element.localName == "body")
    {
        if (element.background != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLImagesAll) ||
                ((menuAction == 1 && !saveHTMLImagesAll) || menuAction == 0) && displayed)
            {
                if (element.background.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.background,baseuri,"image/png","");
                }
            }
        }
    }
    
    /* External image referenced in <img> element */
    
    else if (element.localName == "img")
    {
        if (element.src != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLImagesAll) ||
                ((menuAction == 1 && !saveHTMLImagesAll) || menuAction == 0) && displayed)
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.src,baseuri,"image/png","");
                }
            }
        }
    }
    
    /* External image referenced in <input> element */
    
    else if (element.localName == "input")
    {
        if (element.type.toLowerCase() == "image" && element.src != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLImagesAll) ||
                ((menuAction == 1 && !saveHTMLImagesAll) || menuAction == 0) && displayed)
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.src,baseuri,"image/png","");
                }
            }
        }
    }
    
    /* External audio referenced in <audio> element */
    
    else if (element.localName == "audio")
    {
        if (element.src != "" && element.src == element.currentSrc)
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.src,baseuri,"audio/mpeg","");
                }
            }
        }
    }
    
    /* External video and image referenced in <video> element */
    
    else if (element.localName == "video")
    {
        if (element.src != "" && element.src == element.currentSrc)
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.src,baseuri,"video/mp4","");
                }
            }
        }
        
        if (element.poster != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
            {
                if (menuAction == 2 || (menuAction == 1 && saveHTMLImagesAll) ||
                    ((menuAction == 1 && !saveHTMLImagesAll) || menuAction == 0) && displayed)
                {
                    if (element.poster.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                    {
                        baseuri = element.ownerDocument.baseURI;
                        
                        rememberURL(element.poster,baseuri,"image/png","");
                    }
                }
            }
        }
    }
    
    /* External audio/video referenced in <source> element */
    
    else if (element.localName == "source")
    {
        if (element.src != "" && element.src == element.parentElement.currentSrc)
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    if (element.parentElement.localName == "audio") rememberURL(element.src,baseuri,"audio/mpeg","");
                    else if (element.parentElement.localName == "video") rememberURL(element.src,baseuri,"video/mp4","");
                }
            }
        }
    }
    
    /* External subtitles referenced in <track> element */
    
    else if (element.localName == "track")
    {
        if (element.src != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    charset = element.ownerDocument.characterSet;
                    
                    rememberURL(element.src,baseuri,"text/vtt",charset);
                }
            }
        }
    }
    
    /* External data referenced in <object> element */
    
    else if (element.localName == "object")
    {
        if (element.data != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLObjectEmbed))
            {
                if (element.data.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.data,baseuri,"application/octet-stream","");
                }
            }
        }
    }
    
    /* External data referenced in <embed> element */
    
    else if (element.localName == "embed")
    {
        if (element.src != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLObjectEmbed))
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.src,baseuri,"application/octet-stream","");
                }
            }
        }
    }
    
    /* Handle nested frames and child elements */
    
    if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
    {
        try
        {
            if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before finding */
            {
                if (depth < maxFrameDepth)
                {
                    findOtherResources(depth+1,element.contentWindow,element.contentDocument.documentElement);
                }
            }
        }
        catch (e) {}  /* attempting cross-domain web page access */
    }
    else
    {
        for (i = 0; i < element.children.length; i++)
            if (element.children[i] != null)  /* in case web page not fully loaded before finding */
                findOtherResources(depth,frame,element.children[i]);
                
        if (element.localName == "head" && depth == 0)
        {
            if (!iconFound)
            {
                baseuri = element.ownerDocument.baseURI;
                
                rememberURL("/favicon.ico",baseuri,"image/vnd.microsoft.icon","");
            }
        }
    }
}

function findCSSURLsInStyleSheet(csstext,baseuri)
{
    var i,regex,location,fontfamily,fontweight,fontstyle,fontstretch;
    var fontmatches,includewoff,usedfilefound,wofffilefound,srcregex,urlregex,fontfiletype;
    var matches = new Array();
    var propmatches = new Array();
    var srcmatches = new Array();
    var urlmatches = new Array();
    
    
    /* @import url() excluding existing data uri or */
    /* @font-face rule or */
    /* image url() excluding existing data uri or */
    /* avoid matches inside double-quote strings */
    /* avoid matches inside single-quote strings */
    /* avoid matches inside comments */
    
    regex = new RegExp(/(?:@import\s*(?:url\(\s*)?(?:'|")?(?!data:)([^\s'";)]+)(?:'|")?(?:\s*\))?\s*;)|/.source +  /* matches[1] */
                       /(?:@font-face\s*({[^}]*}))|/.source +  /* matches[2] */
                       /(?:url\(\s*(?:'|")?(?!data:)([^\s'")]+)(?:'|")?\s*\))|/.source +  /* matches[3] */
                       /(?:"(?:\\"|[^"])*")|/.source +
                       /(?:'(?:\\'|[^'])*')|/.source +
                       /(?:\/\*(?:\*[^\\]|[^\*])*?\*\/)/.source,
                       "gi");
                       
    while ((matches = regex.exec(csstext)) != null)  /* style sheet imported into style sheet */
    {
        if (matches[0] && matches[0].substr(0,7).toLowerCase() == "@import")  /* @import url() */
        {
            if (baseuri != null)
            {
                location = resolveURL(matches[1],baseuri);
                
                if (location != null)
                {
                    for (i = 0; i < resourceLocation.length; i++)
                        if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
                    
                    if (i < resourceLocation.length)  /* style sheet found */
                    {
                        findCSSURLsInStyleSheet(resourceContent[i],resourceLocation[i]);
                    }
                }
            }
        }
        else if (matches[0] && matches[0].substr(0,10).toLowerCase() == "@font-face")  /* @font-face rule */
        {
            includewoff = (menuAction == 2 || (menuAction == 1 && saveCSSFontsWoff));
            
            propmatches = matches[2].match(/font-family\s*:\s*(?:'|")?([^'";}]*)(?:'|")?/i);
            if (propmatches == null) fontfamily = ""; else fontfamily = "\"" + propmatches[1] + "\"";
            
            propmatches = matches[2].match(/font-weight\s*:\s*([^\s;}]*)/i);
            if (propmatches == null) fontweight = "normal"; else fontweight = propmatches[1];
            
            propmatches = matches[2].match(/font-style\s*:\s*([^\s;}]*)/i);
            if (propmatches == null) fontstyle = "normal"; else fontstyle = propmatches[1];
            
            propmatches = matches[2].match(/font-stretch\s*:\s*([^\s;}]*)/i);
            if (propmatches == null) fontstretch = "normal"; else fontstretch = propmatches[1];
            
            fontmatches = false;
            
            document.fonts.forEach(  /* CSS Font Loading Module */
            function(font)
            {
                if (font.status == "loaded")  /* font is being used in this page */
                {
                    if (font.family == fontfamily && font.weight == fontweight &&
                        font.style == fontstyle && font.stretch == fontstretch) fontmatches = true;  /* font matches this @font-face rule */
                }
            });
            
            if (fontmatches)
            {
                usedfilefound = false;
                wofffilefound = false;
                
                srcregex = /src:([^;}]*)[;}]/gi;  /* @font-face src list */
                
                while ((srcmatches = srcregex.exec(matches[2])) != null)  /* src: list of font file URL's */
                {
                    urlregex = /url\(\s*(?:'|")?(?!data:)([^\s'")]+)(?:'|")?\s*\)/gi;  /* font url() excluding existing data uri */
                    
                    while ((urlmatches = urlregex.exec(srcmatches[1])) != null)  /* font file URL */
                    {
                        if (urlmatches[1].indexOf(".woff2") >= 0) fontfiletype = "woff2";  /* Chrome, Opera & Firefox */
                        else if (urlmatches[1].indexOf(".woff") >= 0 && urlmatches[1].indexOf(".woff2") < 0) fontfiletype = "woff";  /* all browsers */
                        else if (urlmatches[1].indexOf(".ttf") >= 0) fontfiletype = "ttf";  /* all browsers */
                        else if (urlmatches[1].indexOf(".otf") >= 0) fontfiletype = "otf";  /* all browsers */
                        else if (urlmatches[1].indexOf(".svg") >= 0 && !isFirefox) fontfiletype = "svg";  /* Chrome, Opera & Safari */
                        else fontfiletype = "";
                        
                        if (fontfiletype != "")
                        {
                            if (!usedfilefound)
                            {
                                usedfilefound = true;  /* first font file supported by this browser - should be the one used by this browser */
                                
                                if (fontfiletype == "woff") wofffilefound = true;
                                
                                rememberURL(urlmatches[1],baseuri,"application/font-woff","");
                            }
                            else if (includewoff && fontfiletype == "woff")
                            {
                                wofffilefound = true;  /* woff font file supported by all browsers */
                                
                                rememberURL(urlmatches[1],baseuri,"application/font-woff","");
                            }
                        }
                        
                        if (wofffilefound || (!includewoff && usedfilefound)) break;
                    }
                    
                    if (wofffilefound || (!includewoff && usedfilefound)) break;
                }
            }
        }
        else  if (matches[0].substr(0,4).toLowerCase() == "url(")  /* image url() */
        {
            if (menuAction == 1 && saveCSSImagesAll)
            {
                rememberURL(matches[3],baseuri,"image/png","");
            }
        }
        else if (matches[0].substr(0,1) == "\"") ;  /* double-quote string */
        else if (matches[0].substr(0,1) == "'") ;  /* single-quote string */
        else if (matches[0].substr(0,2) == "/*") ;  /* comment */
    }
}

function rememberURL(url,baseuri,mimetype,charset)
{
    var i,location;
    
    if (savedPage) return -1;  /* ignore new resources when re-saving */
    
    if (baseuri != null)
    {
        location = resolveURL(url,baseuri);
        
        if (location != null)
        {
            for (i = 0; i < resourceLocation.length; i++)
                if (resourceLocation[i] == location) break;
            
            if (i == resourceLocation.length)  /* new resource */
            {
                resourceLocation[i] = location;
                resourceMimeType[i] = mimetype;  /* default if load fails */
                resourceCharSet[i] = charset;  /* default if load fails */
                resourceContent[i] = "";  /* default if load fails */
                resourceStatus[i] = "pending";
                resourceRemembered[i] = 1;
                resourceReplaced[i] = 0;
                
                return i;
            }
            else resourceRemembered[i]++;  /* repeated resource */
        }
    }
    
    return -1;
}

/************************************************************************/

/* Load resources - after first or second passes */

function loadResources()
{
    var i,documentURL;
    
    resourceCount = 0;
/*    
    for (i = 0; i < resourceLocation.length; i++)
    {
        if (resourceStatus[i] == "pending") 
        {
            resourceCount++;
            
            documentURL = new URL(document.baseURI,"about:blank");
            
            chrome.runtime.sendMessage({ type: "loadResource", index: i, location: resourceLocation[i], pagescheme: documentURL.protocol });
        }
    }
    if (resourceCount <= 0)
    {
        if (passNumber == 1) gatherOtherResources();
        else if (passNumber == 2) (usePageLoader && !savedPage) ? loadPageLoader() : generateHTML();
    }
*/
    generateHTML();
}

function loadSuccess(index,content,contenttype,alloworigin)
{
    var i,mimetype,charset,documentURL,resourceURL,csstext,baseuri,regex;
    var matches = new Array();
    
    /* Extract file MIME type and character set */
    
    matches = contenttype.match(/([^;]+)/i);
    if (matches != null) mimetype = matches[1].toLowerCase();
    else mimetype = "";
    console.log("SAVEPAGE: loadSuccess: MIME " + mimetype)
    
    matches = contenttype.match(/;charset=([^;]+)/i);
    if (matches != null) charset = matches[1].toLowerCase();
    else charset = "";
    
    /* Process file based on expected MIME type */
    
    switch (resourceMimeType[index].toLowerCase())  /* expected MIME type */
    {
        case "application/font-woff":  /* font file */
            
            documentURL = new URL(document.baseURI,"about:blank");
            resourceURL = new URL(resourceLocation[index],"about:blank");
            
            if (resourceURL.origin != documentURL.origin &&  /* cross-origin */
                (alloworigin == "" || (alloworigin != "*" && alloworigin != documentURL.origin)))  /* either no header or no origin match */
            {
                loadFailure(index);
                return;
            }

        case "image/png":  /* image file */
        case "image/vnd.microsoft.icon":  /* icon file */
        case "audio/mpeg":  /* audio file */
        case "video/mp4":  /* video file */
        case "application/octet-stream":  /* data file */
            
            if (mimetype != "") resourceMimeType[index] = mimetype;
            
            resourceContent[index] = content;
            
            break;
            
        case "application/javascript":  /* javascript file */
            
            if (mimetype != "application/javascript" && mimetype != "application/x-javascript" && mimetype != "application/ecmascript" &&
                mimetype != "application/json" && mimetype != "text/javascript" && mimetype != "text/x-javascript" && mimetype != "text/json")
            {
                loadFailure(index);
                return;
            }
            
        case "text/vtt":  /* subtitles file */
            
            if (mimetype != "") resourceMimeType[index] = mimetype;
            if (charset != "") resourceCharSet[index] = charset;
            
            if (content.charCodeAt(0) == 0xEF && content.charCodeAt(1) == 0xBB && content.charCodeAt(2) == 0xBF)  /* BOM */
            { 
                resourceCharSet[index] = "utf-8";
                content = content.substr(3);
            }
            
            if (resourceCharSet[index].toLowerCase() == "utf-8")
            {
                try
                {
                    resourceContent[index] = convertUTF8ToUTF16(content);  /* UTF-8 */
                }
                catch (e)
                {
                    resourceCharSet[index] = "iso-8859-1";  /* assume ISO-8859-1 */
                    resourceContent[index] = content;
                }
            }
            else resourceContent[index] = content;  /* ASCII, ANSI, ISO-8859-1, etc */
            
            break;
            
        case "text/css":  /* css file */
            
            if (mimetype != "text/css")  /* incorrect MIME type */
            {
                loadFailure(index);
                return;
            }
            
            matches = content.match(/^@charset "([^"]+)";/i);
            if (matches != null) resourceCharSet[index] = matches[1];
            
            if (charset != "") resourceCharSet[index] = charset;
            
            if (content.charCodeAt(0) == 0xEF && content.charCodeAt(1) == 0xBB && content.charCodeAt(2) == 0xBF)  /* BOM */
            {
                resourceCharSet[index] = "utf-8";
                content = content.substr(3);
            }
            
            if (resourceCharSet[index].toLowerCase() == "utf-8")
            {
                try
                {
                    resourceContent[index] = convertUTF8ToUTF16(content);  /* UTF-8 */
                }
                catch (e)
                {
                    resourceCharSet[index] = "iso-8859-1";  /* assume ISO-8859-1 */
                    resourceContent[index] = content;
                }
            }
            else resourceContent[index] = content;  /* ASCII, ANSI, ISO-8859-1, etc */
            
            /* External style sheets imported in external style sheet */
            
            csstext = resourceContent[index];
            
            baseuri = resourceLocation[index];
            
            regex = /@import\s*(?:url\(\s*)?(?:'|")?(?!data:)([^\s'";)]+)(?:'|")?(?:\s*\))?\s*;/gi;  /* @import url() excluding existing data uri */
            
            while ((matches = regex.exec(csstext)) != null)  /* style sheet imported into style sheet */
            {
                i = rememberURL(matches[1],baseuri,"text/css",resourceCharSet[index]);
                
                if (i >= 0)
                {
                    resourceCount++;
                    
                    documentURL = new URL(document.baseURI,"about:blank");
                    
                    chrome.runtime.sendMessage({ type: "loadResource", index: i, location: resourceLocation[i], pagescheme: documentURL.protocol });
                }
            }
            
            break;
    }
    
    resourceStatus[index] = "success";
    
    if (--resourceCount <= 0)
    {
        if (passNumber == 1) gatherOtherResources();
        else if (passNumber == 2) (usePageLoader && !savedPage) ? loadPageLoader() : generateHTML(); 
    }
}

function loadFailure(index)
{
    resourceStatus[index] = "failure";
    
    if (--resourceCount <= 0)
    {
        if (passNumber == 1) gatherOtherResources();
        else if (passNumber == 2) (usePageLoader && !savedPage) ? loadPageLoader() : generateHTML();
    }
}

function loadPageLoader()
{
    var xhr;
    
    xhr = new XMLHttpRequest();
    xhr.open("GET",chrome.extension.getURL("pageloader_compressed.js"),true);
    xhr.onload = complete;
    xhr.send();
    
    function complete()
    {
        if (xhr.status == 200)
        {
            pageLoader = xhr.responseText.substr(xhr.responseText.indexOf('"use strict";'));
            
            generateHTML();
        }
    }
}

/************************************************************************/

/* Third Pass - to generate HTML and save to file */

function generateHTML()
{
    var i,j,dataurisize,skipcount,failcount,count,maxstrsize,totalstrsize,mimetype,charset,htmlBlob,objectURL,documentURL,filename,datestr,link;
    var skipurllist = new Array();
    var failurllist = new Array();
    var pathsegments = new Array();
    var date = new Date();

    console.log("SAVEPAGE: generateHTML");
    
    passNumber = 3;
    
    chrome.runtime.sendMessage({ type: "setSaveBadge", text: "SAVE", color: "#0000E0" });
    
    /* Release resources */
    
    resourceLocation.length = 0;
    resourceMimeType.length = 0;
    resourceCharSet.length = 0;
    resourceContent.length = 0;
    resourceStatus.length = 0;
    resourceRemembered.length = 0;
    resourceReplaced.length = 0;
    
    /* Save to file using HTML5 download attribute */
    
    /*htmlBlob = new Blob( htmlStrings, { type: "text/html" });*/

    htmlStrings.length = 0;
    htmlStrings[0] = document.documentElement.outerHTML;
    htmlBlob = new Blob(htmlStrings, { type: "text/x-recoll-html" });    
    objectURL = window.URL.createObjectURL(htmlBlob);
    
    htmlStrings.length = 0;
    
    documentURL = new URL(document.baseURI,"about:blank");
    
    if (document.title == "")
    {
        pathsegments = documentURL.pathname.split("/");
        filename = pathsegments.pop();
        if (filename == "") filename = pathsegments.pop();
        
        filename = decodeURIComponent(filename);
        
        i = filename.lastIndexOf(".");
        if (i < 0) filename = filename + ".html";
        else filename = filename.substring(0,i) + ".html";
    }
    else filename = document.title + ".html";
    
    if (prefixFileName) filename = "{" + documentURL.hostname + "} " + filename;
    
    if (suffixFileName)
    {
        datestr = new Date(date.getTime()-(date.getTimezoneOffset()*60000)).toISOString();
        datestr = datestr.substr(2,17);
        datestr = datestr.replace(/T/," ");
        datestr = datestr.replace(/:/g,"-");
        
        i = filename.lastIndexOf(".");
        if (i < 0) filename = filename + " {" + datestr + "}";
        else filename = filename.substring(0,i) +  " {" + datestr + "}" + filename.substring(i);
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
        chrome.runtime.sendMessage({ type: "downloadFile", location: document.location.href, filename: filename });
        window.setTimeout(
            function()
            {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(objectURL);
                chrome.runtime.sendMessage({ type: "setSaveBadge", text: "", color: "#000000" });
            }, 100);
        function handleClick(event)
        {
            event.stopPropagation();
        }
    } else {
        if (1) {
            console.log("SAVEPAGE: send download message for " + document.location.href + " filename " + filename);
            chrome.runtime.sendMessage({ type: "downloadFile", location: document.location.href, filename: filename });
        } else {
            resourceLocation[0] = document.location.href;
            console.log("SAVEPAGE: sendMessage loadResource for " + resourceLocation[0]);
            chrome.runtime.sendMessage({ type: "loadResource", index: 0, location: resourceLocation[0],
                                         pagescheme: documentURL.protocol });
        }
    }
}

function extractHTML(depth,frame,element)
{
    var i,j,doctype,startTag,endTag,textContent,baseuri,location,csstext,origurl,datauri,origstr,target,htmltext,startindex,endindex,text,date,state;
    var voidElements = new Array("area","base","br","col","command","embed","frame","hr","img","input","keygen","link","menuitem","meta","param","source","track","wbr");
    var htmlFrameStrings = new Array();
    var matches = new Array();
    
    /* Extract HTML from DOM and replace external resources with data URI's */
    console.log("SAVEPAGE: extractHTML");
    
    startTag = "<" + element.localName;
    for (i = 0; i < element.attributes.length; i++)
    {
        if (element.attributes[i].name != "zoompage-fontsize")
        {
            startTag += " " + element.attributes[i].name;
            startTag += "=\"";
            startTag += element.attributes[i].value.replace(/"/g,"&quot;");
            startTag += "\"";
        }
    }
    startTag += ">";
    
    textContent = "";
    
    if (voidElements.indexOf(element.localName) >= 0) endTag = "";
    else endTag = "</" + element.localName + ">";
    
    /* External images referenced in any element's style attribute */
    
    if (element.hasAttribute("style"))
    {
        csstext = element.getAttribute("style");
        
        baseuri = element.ownerDocument.baseURI;
        
        csstext = replaceCSSURLs(csstext,baseuri);
        
        startTag = startTag.split("style=\"" + element.getAttribute("style").replace(/"/g,"&quot;") + "\"").join("style=\"" + csstext.replace(/"/g,"&quot;") + "\"");
    }
    
    /* Internal script in <script> element */
    /* External script in <script> element */
    
    if (element.localName == "script")
    {
        if (element.src == "")  /* internal script */
        {
            if (menuAction == 2 || (menuAction == 1 && saveScripts)) textContent = element.textContent;
        }
        else /* element.src != "" */  /* external script */
        {
            if (menuAction == 2 || (menuAction == 1 && saveScripts))
            {
                if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    origurl = element.getAttribute("src");
                    
                    datauri = replaceURL(origurl,baseuri);
                    
                    origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                    
                    startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                }
            }
            else
            {
                origurl = element.getAttribute("src");
                
                origstr = " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"\"");
            }
        }
    }
    
    /* External images or fonts referenced in <style> element */
    
    else if (element.localName == "style")
    {
        if (element.id == "zoompage-pageload-style" || element.id == "zoompage-zoomlevel-style" || element.id == "zoompage-fontsize-style")
        {
            startTag = "";
            endTag = "";
            textContent = "";
        }
        else
        {
            csstext = element.textContent;
            
            baseuri = element.ownerDocument.baseURI;
            
            textContent = replaceCSSURLsInStyleSheet(csstext,baseuri);
        }
    }
    
    /* External images or fonts referenced in <link> element */
    /* External icon referenced in <link> element */
    
    else if (element.localName == "link")
    {
        if (element.rel.toLowerCase() == "stylesheet" && element.getAttribute("href") != "" && element.href != "")    /* href attribute and property may be different */
        {
            if (element.href.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                if (baseuri != null)
                {
                    location = resolveURL(element.href,baseuri);
                    
                    if (location != null)
                    {
                        for (i = 0; i < resourceLocation.length; i++)
                            if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
                        
                        if (i < resourceLocation.length)  /* style sheet found */
                        {
                            csstext = resourceContent[i];
                            
                            baseuri = element.href;
                            
                            csstext = replaceCSSURLsInStyleSheet(csstext,baseuri);
                            
                            startTag = "<style data-savepage-href=\"" + element.getAttribute("href") + "\"";
                            if (element.type != "") startTag += " type=\"" + element.type + "\"";
                            if (element.media != "") startTag += " media=\"" + element.media + "\"";
                            startTag += ">" + csstext + "</style>";
                            endTag = "";
                            
                            resourceReplaced[i]++;
                        }
                    }
                }
            }
        }
        else if ((element.rel.toLowerCase() == "icon" || element.rel.toLowerCase() == "shortcut icon") && element.href != "")
        {
            if (element.href.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("href");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-href=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ href="[^"]*"/,origstr + " href=\"" + datauri + "\"");
            }
        }
    }
    
    /* Remove existing base element */
    
    else if (element.localName == "base")
    {
        startTag = "";
        endTag = "";
    }
    
    /* Remove previous saved page information */
    
    else if (element.localName == "meta")
    {
        if (element.name.substr(0,8) == "savepage")
        {
            startTag = "";
            endTag = "";
        }
    }
    
    /* External image referenced in <background> element */
    
    else if (element.localName == "body")
    {
        if (element.background != "")
        {
            if (element.background.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("background");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-background=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ background="[^"]*"/,origstr + " background=\"" + datauri + "\"");
            }
        }
    }
    
    /* External image referenced in <img> element */
    
    else if (element.localName == "img")
    {
        if (element.src != "")
        {
            if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
        
        if (element.srcset != "")
        {
            origurl = element.getAttribute("srcset");
            
            origstr = " data-savepage-srcset=\"" + origurl + "\"";
            
            startTag = startTag.replace(/ srcset="[^"]*"/,origstr + " srcset=\"\"");
        }
    }
    
    /* External image referenced in <input> element */
    /* Reinstate checked state or text value of <input> element */
    
    else if (element.localName == "input")
    {
        if (element.type.toLowerCase() == "image" && element.src != "")
        {
            if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;

                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
        
        if (element.type.toLowerCase() == "file" || element.type.toLowerCase() == "password")
        {
            /* maintain security */
        }
        else if (element.type.toLowerCase() == "checkbox" || element.type.toLowerCase() == "radio")
        {
            startTag = startTag.replace(/ checked="[^"]*"/,"");
            
            if (element.checked) startTag = startTag.replace(/>/," checked=\"\">");
        }
        else
        {
            startTag = startTag.replace(/ value="[^"]*"/,"");
            
            startTag = startTag.replace(/>/," value=\"" + element.value + "\">");
        }
    }
    
    /* Reinstate text value of <textarea> element */
    
    else if (element.localName == "textarea")
    {
        textContent = element.value;
    }
    
    /* Reinstate selected state of <option> element */
    
    else if (element.localName == "option")
    {
        startTag = startTag.replace(/ selected="[^"]*"/,"");
        
        if (element.selected) startTag = startTag.replace(/>/," selected=\"\">");
    }
    
    /* External audio referenced in <audio> element */
    
    else if (element.localName == "audio")
    {
        if (element.src != "" && element.src == element.currentSrc)
        {
            if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
    }
    
    /* External video referenced in <video> element */
    
    else if (element.localName == "video")
    {
        if (element.src != "" && element.src == element.currentSrc)
        {
            if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
        
        if (element.poster != "")
        {
            if (element.poster.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("poster");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-poster=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ poster="[^"]*"/,origstr + " poster=\"" + datauri + "\"");
            }
        }
    }
    
    /* External audio/video referenced in <source> element */
    
    else if (element.localName == "source")
    {
        if (element.src != "" && element.src == element.parentElement.currentSrc)
        {
            if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
    }
    
    /* External subtitles referenced in <track> element */
    
    else if (element.localName == "track")
    {
        if (element.src != "")
        {
            if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
    }
    
    /* External data referenced in <object> element */
    
    else if (element.localName == "object")
    {
        if (element.data != "")
        {
            if (element.data.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("data");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-data=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ data="[^"]*"/,origstr + " data=\"" + datauri + "\"");
            }
        }
    }
    
    /* External data referenced in <embed> element */
    
    else if (element.localName == "embed")
    {
        if (element.src != "")
        {
            if (element.src.substr(0,5).toLowerCase() != "data:")  /* exclude existing data uri */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
    }
    
    /* Handle nested frames and child elements & text nodes & comment nodes */
    /* Generate HTML into array of strings */
    
    if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
    {
        if (element.src != "")
        {
            baseuri = element.ownerDocument.baseURI;
            
            origurl = element.getAttribute("src");
            
            datauri = origurl;
            
            if (baseuri != null)
            {
                location = resolveURL(element.src,baseuri);
                
                if (location != null)
                {
                    try
                    {
                        if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before extracting */
                        {
                            if (depth < maxFrameDepth)
                            {
                                startindex = htmlStrings.length;
                                
                                extractHTML(depth+1,element.contentWindow,element.contentDocument.documentElement);
                                
                                endindex = htmlStrings.length;
                                
                                htmlFrameStrings = htmlStrings.splice(startindex,endindex-startindex);
                                
                                htmltext = htmlFrameStrings.join("");
                                
                                datauri = "data:text/html;charset=utf-8," + encodeURIComponent(htmltext);
                            }
                        }
                    }
                    catch (e) {}  /* attempting cross-domain web page access */
                }
            }
            
            origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
            
            startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            
            if (element.localName == "iframe") htmlStrings[htmlStrings.length] = startTag + endTag;
            else htmlStrings[htmlStrings.length] = startTag;
        }
    }
    else
    {
        if (element.localName == "html")
        {
            /* Add !DOCTYPE declaration */
            
            doctype = element.ownerDocument.doctype;
            
            if (doctype != null)
            {
                htmltext = '<!DOCTYPE ' + doctype.name + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
                           ((doctype.systemId && !doctype.publicId) ? ' SYSTEM' : '') + (doctype.systemId ? ' "' + doctype.systemId + '"' : '') + '>';
                
                htmlStrings[htmlStrings.length] = htmltext;
            }
        }
        
        htmlStrings[htmlStrings.length] = startTag;
        
        if (element.localName == "head")
        {
            /* Add <base> element to make relative URL's work in saved file */
            
            if (element.ownerDocument.head.querySelector("base") != null) target = element.ownerDocument.head.querySelector("base").target;
            else target = "";
            
            htmltext = "\n";
            htmltext += "<base href=\"" + element.ownerDocument.baseURI + "\"";
            if (target != "") htmltext += " target=\"" + target + "\"";
            htmltext += ">\n";
            
            htmlStrings[htmlStrings.length] = htmltext;
        }
        
        if (voidElements.indexOf(element.localName) >= 0) ;  /* void element */
        else if (element.localName == "style" || (element.localName == "script" && element.src == ""))  /* <style> or <script> element */
        {
            htmlStrings[htmlStrings.length] = textContent;
        }
        else if (element.localName == "textarea")  /* <textarea> element */
        {
            textContent = textContent.replace(/&/g,"&amp;");
            textContent = textContent.replace(/</g,"&lt;");
            textContent = textContent.replace(/>/g,"&gt;");
            
            htmlStrings[htmlStrings.length] = textContent;
        }
        else
        {
            for (i = 0; i < element.childNodes.length; i++)
            {
                if (element.childNodes[i] != null)  /* in case web page not fully loaded before extracting */
                {
                    if (element.childNodes[i].nodeType == 1)  /* element node */
                    {
                        extractHTML(depth,frame,element.childNodes[i]);
                    }
                    else if (element.childNodes[i].nodeType == 3)  /* text node */
                    {
                        text = element.childNodes[i].textContent;
                        
                        text = text.replace(/&/g,"&amp;");
                        text = text.replace(/</g,"&lt;");
                        text = text.replace(/>/g,"&gt;");
                        
                        htmlStrings[htmlStrings.length] = text;
                    }
                    else if (element.childNodes[i].nodeType == 8)  /* comment node */
                    {
                        htmlStrings[htmlStrings.length] = "<!--" + element.childNodes[i].textContent + "-->";
                    }
                }
            }
        }
        
        if (element.localName == "head" && depth == 0)
        {
            /* Add favicon if missing */
            
            if (!iconFound)
            {
                baseuri = element.ownerDocument.baseURI;
                
                datauri = replaceURL("/favicon.ico",baseuri);
                
                htmltext = "\n";
                htmltext += "<link rel=\"icon\" href=\"" + datauri + "\">\n";
                
                htmlStrings[htmlStrings.length] = htmltext;
            }
            
            /* Add page loader script */
            
            if (usePageLoader && !savedPage)
            {
                htmlStrings[htmlStrings.length] = "\n<script id=\"savepage-pageloader\" type=\"application/javascript\">\n";
                htmlStrings[htmlStrings.length] = "savepage_PageLoader(" + maxFrameDepth + ");\n";
                htmlStrings[htmlStrings.length] = pageLoader.substr(0,pageLoader.length-1);  /* remove final '}' */
                htmlStrings[htmlStrings.length] = "\n";
                for (i = 0; i < resourceLocation.length; i++) 
                {
                    if (resourceStatus[i] == "success" && resourceCharSet[i] == "")  /* charset not defined - therefore binary data */
                    {
                        htmlStrings[htmlStrings.length] = "resourceMimeType[" + i + "] = \"" + resourceMimeType[i] + "\"; ";
                        htmlStrings[htmlStrings.length] = "resourceBase64Data[" + i + "] = \"" + btoa(resourceContent[i]) + "\";\n";
                    }
                }
                htmlStrings[htmlStrings.length] = "}\n</script>";
            }
            
            /* Add saved page information */
            
            date = new Date();
            
            if (menuAction == 0)
            {
                state = "Current State;";
                if (usePageLoader && !savedPage) state += " Used page loader;";
                if (removeUnsavedURLs) state += " Removed unsaved URLs;";
                state += " Max frame depth = " + maxFrameDepth + ";";
                state += " Max resource size = " + maxResourceSize + "MB;";
            }
            else if (menuAction == 1)
            {
                state = "Chosen Items;";
                if (saveHTMLAudioVideo) state += " HTML audio & video;";
                if (saveHTMLObjectEmbed) state += " HTML object & embed;";
                if (saveHTMLImagesAll) state += " HTML images all;";
                if (saveCSSImagesAll) state += " CSS images all;";
                if (saveCSSFontsWoff) state += " CSS fonts woff;";
                if (saveScripts) state += " Scripts;";
                if (usePageLoader && !savedPage) state += " Used page loader;";
                if (removeUnsavedURLs) state += " Removed unsaved URLs;";
                state += " Max frame depth = " + maxFrameDepth + ";";
                state += " Max resource size = " + maxResourceSize + "MB;";
            }
            else if (menuAction == 2)
            {
                state = "Complete Page - excludes CSS images (all);";
                if (usePageLoader && !savedPage) state += " Used page loader;";
                if (removeUnsavedURLs) state += " Removed unsaved URLs;";
                state += " Max frame depth = " + maxFrameDepth + ";";
                state += " Max resource size = " + maxResourceSize + "MB;";
            }
            
            htmltext = "\n";
            htmltext += "<meta name=\"savepage-url\" content=\"" + decodeURIComponent(document.URL) + "\">\n";
            htmltext += "<meta name=\"savepage-title\" content=\"" + document.title + "\">\n";
            htmltext += "<meta name=\"savepage-date\" content=\"" + date.toString() + "\">\n";
            htmltext += "<meta name=\"savepage-state\" content=\"" + state + "\">\n";
            htmltext += "<meta name=\"savepage-version\" content=\"" + chrome.runtime.getManifest().version + "\">\n";
            
            htmlStrings[htmlStrings.length] = htmltext;
        }
        
        if (element.localName == "body" && depth == 0)
        {
            if (includeInfoBar)
            {
                /* Add page info bar */
                
                date = new Date();
                
                htmltext = "\n";
                htmltext += "<div id=\"savepage-pageinfo-bar\" style=\"display: flex !important; position: fixed !important; left:0px !important; top: 0px !important;";
                htmltext += " width: 100% !important; height: 25px !important; border-bottom: 1px solid #E0E0E0 !important; font-family: 'Segoe UI','Helvetica Neue',Ubuntu,Arial !important; font-size: 12px !important;";
                htmltext += " color: black !important; background-color: #FFFFE0 !important; overflow: hidden !important; z-index: 2147483645 !important; cursor: default !important;\">";
                htmltext += "<img src onerror=\"document.body.style.setProperty('position','relative','important'); document.body.style.setProperty('margin-top','25px','important');\"";
                htmltext += " style=\"display: none !important;\">"; 
                htmltext += "<div style=\"flex: 0 1 auto !important; padding: 4px 0px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;\">";
                htmltext += "&nbsp;&nbsp;Saved from:&nbsp;&nbsp<a href=\"" + document.URL + "\" target=\"_blank\" style=\"padding: 4px 0px !important; color: #6060E0 !important;\">" + decodeURIComponent(document.URL) + "</a>";
                htmltext += "</div>";
                htmltext += "<div style=\"flex: 1 1 auto !important;\">&nbsp;&nbsp;&nbsp;&nbsp;</div>";
                htmltext += "<div style=\"flex: 0 100000000 auto !important; min-width: 0px !important; padding: 4px 0px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;\">";
                htmltext += "Saved on:&nbsp;&nbsp;" + date.toDateString().substr(8,2) + " " + date.toDateString().substr(4,3) + " " + date.toDateString().substr(11,4) + " at " + date.toTimeString().substr(0,8) + "&nbsp;&nbsp;";
                htmltext += "</div>";
                htmltext += "<div style=\"flex: 0 0 auto !important; padding: 3px; border-left: 1px solid #E0E0E0 !important; border-right: 1px solid #E0E0E0 !important;\">";
                htmltext += "<div onmouseover=\"this.style.backgroundColor = '#E0E0E0';\" onmouseout=\"this.style.backgroundColor = '#F0F0F0';\"";
                htmltext += " onclick=\"document.body.style.removeProperty('position'); document.body.style.removeProperty('margin-top'); document.body.removeChild(this.parentElement.parentElement);\"";
                htmltext += " style=\"padding: 0px 5px !important; border: 1px solid #E0E0E0; background-color: #F0F0F0 !important; font-size: 12px !important;\">";
                htmltext += "X";
                htmltext += "</div>";
                htmltext += "</div>";
                htmltext += "\n";
                
                htmlStrings[htmlStrings.length] = htmltext;
            }
        }
        
        htmlStrings[htmlStrings.length] = endTag;
    }
}

function replaceCSSURLsInStyleSheet(csstext,baseuri)
{
    var regex;
    var matches = new Array();
    
    /* @import url() excluding existing data uri or */
    /* font or image url() excluding existing data uri or */
    /* avoid matches inside double-quote strings */
    /* avoid matches inside single-quote strings */
    /* avoid matches inside comments */
    
    regex = new RegExp(/(?:( ?)@import\s*(?:url\(\s*)?(?:'|")?(?!data:)([^\s'";)]+)(?:'|")?(?:\s*\))?\s*;)|/.source +  /* p1 & p2 */
                       /(?:( ?)url\(\s*(?:'|")?(?!data:)([^\s'")]+)(?:'|")?\s*\))|/.source +  /* p3 & p4 */
                       /(?:"(?:\\"|[^"])*")|/.source +
                       /(?:'(?:\\'|[^'])*')|/.source +
                       /(?:\/\*(?:\*[^\\]|[^\*])*?\*\/)/.source,
                       "gi");
    
    csstext = csstext.replace(regex,_replaceCSSURLOrImportStyleSheet);
    
    return csstext;
    
    function _replaceCSSURLOrImportStyleSheet(match,p1,p2,p3,p4,offset,string)
    {
        var i,location,csstext,datauri,origstr;
        
        if (match.trim().substr(0,7).toLowerCase() == "@import")  /* @import url() */
        {
            if (baseuri != null)
            {
                location = resolveURL(p2,baseuri);
                
                if (location != null)
                {
                    for (i = 0; i < resourceLocation.length; i++)
                        if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
                    
                    if (i < resourceLocation.length)  /* style sheet found */
                    {
                        csstext = replaceCSSURLsInStyleSheet(resourceContent[i],resourceLocation[i]);
                        
                        return p1 + "/*savepage-import-url=" + p2 + "*/" + p1 + csstext;
                    }
                }
            }
            
            if (removeUnsavedURLs) return p1 + "/*savepage-import-url=" + p2 + "*/" + p1;
            else return match;  /* original @import rule */
        }
        else if (match.trim().substr(0,4).toLowerCase() == "url(")  /* font or image url() */
        {
            datauri = replaceURL(p4,baseuri);
            
            origstr = (datauri == p4) ? p3 : p3 + "/*savepage-url=" + p4 + "*/" + p3;
            
            return origstr + "url(" + datauri + ")";
        }
        else if (match.substr(0,1) == "\"") return match;  /* double-quote string */
        else if (match.substr(0,1) == "'") return match;  /* single-quote string */
        else if (match.substr(0,2) == "/*") return match;  /* comment */
    }
}

function replaceCSSURLs(csstext,baseuri)
{
    var regex;
    
    regex = /( ?)url\(\s*(?:'|")?(?!data:)([^\s'")]+)(?:'|")?\s*\)/gi;  /* image url() excluding existing data uri */
        
    csstext = csstext.replace(regex,_replaceCSSURL);
    
    return csstext;
    
    function _replaceCSSURL(match,p1,p2,offset,string)
    {
        var datauri,origstr;
        
        datauri = replaceURL(p2,baseuri);
        
        origstr = (datauri == p2) ? p1 : p1 + "/*savepage-url=" + p2 + "*/" + p1;
        
        return origstr + "url(" + datauri + ")";
    }
}

function replaceURL(url,baseuri)
{
    var i,location,count;
    
    if (savedPage) return url;  /* ignore new resources when re-saving */
    
    if (baseuri != null)
    {
        location = resolveURL(url,baseuri);
        
        if (location != null)
        {
            for (i = 0; i < resourceLocation.length; i++)
                if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
            
            if (i < resourceLocation.length)
            {
                if (resourceCharSet[i] == "")  /* charset not defined - therefore binary data */
                {
                    count = usePageLoader ? 1 : resourceRemembered[i];
                    
                    if (resourceContent[i].length*count*(4/3) > maxResourceSize*1024*1024)  /* skip large and/or repeated resource */
                    {
                        if (removeUnsavedURLs) return "";  /* null string */
                        else return url;  /* original url */
                    }
                    
                    resourceReplaced[i]++;
                    
                    if (usePageLoader) return "data:" + resourceMimeType[i] + ";resource=" + i + ";base64,";  /* binary data encoded as Base64 ASCII string */
                    
                    return "data:" + resourceMimeType[i] + ";base64," + btoa(resourceContent[i]);  /* binary data encoded as Base64 ASCII string */
                }
                else  /* charset defined - therefore character data */
                {
                    resourceReplaced[i]++;
                    
                    return "data:" + resourceMimeType[i] + ";charset=utf-8," + encodeURIComponent(resourceContent[i]);  /* characters encoded as UTF-8 %escaped string */
                }
            }
        }
    }
    
    if (removeUnsavedURLs) return "";  /* null string */
    else return url;  /* original url */
}

function showUnsavedResources(title,urllist)
{
    var i,j,k,before,after,urlstring;
    
    before = isFirefox ? 30 : 25;
    after = isFirefox ? 50 : 35;
    
    j = k = 0;
    urlstring = "";
    
    for (i = 0; i < urllist.length; i++)
    {
        if (urllist[i].length > before+after) urlstring += urllist[i].substr(0,before) + "..." + urllist[i].substr(-after) + "\n";
        else urlstring += urllist[i] + "\n";
        
        k++;
        
        if (k-j >= 20 || (k-j > 0 && i == urllist.length-1))
        {
            if (!confirm(title + ":\n\n" + urlstring + "\n")) return false;
            
            j = k;
            urlstring = "";
        }
    }
    
    return true;
}

/************************************************************************/

/* Save utility functions */

function resolveURL(url,baseuri)
{
    var resolvedURL;
    
    try
    {
        resolvedURL = new URL(url,baseuri);
    }
    catch (e)
    {
        return null;  /* baseuri invalid or null */
    }
    
    return resolvedURL.href;
}

function convertUTF8ToUTF16(utf8str)
{
    var i,byte1,byte2,byte3,byte4,codepoint,utf16str;
    
    /* Convert UTF-8 string to Javascript UTF-16 string */
    /* Each codepoint in UTF-8 string comprises one to four 8-bit values */
    /* Each codepoint in UTF-16 string comprises one or two 16-bit values */
    
    i = 0;
    utf16str = "";
    
    while (i < utf8str.length)
    {
        byte1 = utf8str.charCodeAt(i++);
        
        if ((byte1 & 0x80) == 0x00)
        {
            utf16str += String.fromCharCode(byte1);  /* one 16-bit value */
        }
        else if ((byte1 & 0xE0) == 0xC0)
        {
            byte2 = utf8str.charCodeAt(i++);
            
            codepoint = ((byte1 & 0x1F) << 6) + (byte2 & 0x3F);
            
            utf16str += String.fromCodePoint(codepoint);  /* one 16-bit value */
        }
        else if ((byte1 & 0xF0) == 0xE0)
        {
            byte2 = utf8str.charCodeAt(i++);
            byte3 = utf8str.charCodeAt(i++);
            
            codepoint = ((byte1 & 0x0F) << 12) + ((byte2 & 0x3F) << 6) + (byte3 & 0x3F);
            
            utf16str += String.fromCodePoint(codepoint);  /* one 16-bit value */
        }
        else if ((byte1 & 0xF8) == 0xF0)
        {
            byte2 = utf8str.charCodeAt(i++);
            byte3 = utf8str.charCodeAt(i++);
            byte4 = utf8str.charCodeAt(i++);
            
            codepoint = ((byte1 & 0x07) << 18) + ((byte2 & 0x3F) << 12) + ((byte3 & 0x3F) << 6) + (byte4 & 0x3F);
            
            utf16str += String.fromCodePoint(codepoint);  /* two 16-bit values */
        }
    }
    
    return utf16str;
}

/************************************************************************/

/* View saved page information function */

function viewSavedPageInfo()
{
    var i,xhr,parser,pageinfodoc,container,metaurl,metatitle,metadate,metastate,metaversion;
    
    /* Load page info panel */
    
    xhr = new XMLHttpRequest();
    xhr.open("GET",chrome.extension.getURL("pageinfo.html"),true);
    xhr.onload = complete;
    xhr.send();
    
    function complete()
    {
        if (xhr.status == 200)
        {
            /* Parse page info document */
            
            parser = new DOMParser();
            pageinfodoc = parser.parseFromString(xhr.responseText,"text/html");
            
            /* Create container element */
            
            container = document.createElement("div");
            container.setAttribute("id","savepage-pageinfo-container");
            document.body.appendChild(container);
            
            /* Append page info elements */
            
            container.appendChild(pageinfodoc.getElementById("savepage-pageinfo-style"));
            container.appendChild(pageinfodoc.getElementById("savepage-pageinfo-overlay"));
            
            metaurl = document.head.querySelector("meta[name='savepage-url']").content;
            metatitle = document.head.querySelector("meta[name='savepage-title']").content;
            metadate = document.head.querySelector("meta[name='savepage-date']").content;
            metastate = document.head.querySelector("meta[name='savepage-state']").content;
            metaversion = document.head.querySelector("meta[name='savepage-version']").content;
            
            if (metaversion < "6.0") metastate = metastate.replace(/(.*) (Max frame depth = \d+; Max resource size = \d+MB;) (.*)/,"$1 $3 $2");
            if (metaversion < "7.0") metastate = metastate.replace(/CSS fonts used;/,"\n - " + "$&");
            
            metastate = metastate.replace(/HTML audio & video;/,"\n - " + "$&");
            metastate = metastate.replace(/HTML object & embed;/,"\n - " + "$&");
            metastate = metastate.replace(/HTML images all;/,"\n - " + "$&");
            metastate = metastate.replace(/CSS images all;/,"\n - " + "$&");
            metastate = metastate.replace(/CSS fonts woff;/,"\n - " + "$&");
            metastate = metastate.replace(/Scripts;/,"\n - " + "$&");
            metastate = metastate.replace(/Used page loader;/,"\n" + "$&");
            metastate = metastate.replace(/Removed unsaved URLs;/,"\n" + "$&");
            metastate = metastate.replace(/Max frame depth = \d+;/,"\n" + "$&");
            metastate = metastate.replace(/Max resource size = \d+MB;/,"\n" + "$&");
            
            metaversion = "Save Page WE " + metaversion;
            
            document.getElementById("savepage-pageinfo-url").textContent = metaurl;
            document.getElementById("savepage-pageinfo-title").textContent = metatitle;
            document.getElementById("savepage-pageinfo-date").textContent = metadate;
            document.getElementById("savepage-pageinfo-state").textContent = metastate;
            document.getElementById("savepage-pageinfo-version").textContent = metaversion;
            
            document.getElementById("savepage-pageinfo-open").addEventListener("click",openURL,false);
            document.getElementById("savepage-pageinfo-okay").addEventListener("click",closePanel,false);
        }
    }
    
    function openURL()
    {
        window.open(metaurl);
    }
    
    function closePanel()
    {
        document.body.removeChild(document.getElementById("savepage-pageinfo-container"));
    }
}

/************************************************************************/

/* Remove Page Loader function */

function removePageLoader()
{
    var resourceBlobURL = new Array();
    var resourceMimeType = new Array();
    var resourceBase64Data = new Array();
    var resourceStatus = new Array();
    var resourceRemembered = new Array();
    
    var resourceCount;
    
    gatherBlobResources();
    
    /* First Pass - to gather blob resources */
    
    function gatherBlobResources()
    {
        chrome.runtime.sendMessage({ type: "setSaveBadge", text: "REM", color: "#FF8000" });
        
        findBlobResources(0,window,document.documentElement);
        
        loadBlobResources();
    }
    
    function findBlobResources(depth,frame,element)
    {
        var i,csstext,regex;
        var matches = new Array();
        
        if (element.hasAttribute("style"))
        {
            csstext = element.style.cssText;
            regex = /url\(\s*(?:'|")?(blob:[^\s'")]+)(?:'|")?\s*\)/gi;
            while ((matches = regex.exec(csstext)) != null) rememberBlobURL(matches[1],"image/png");
        }
        
        if (element.localName == "style")
        {
            csstext = element.textContent;
            regex = /url\(\s*(?:'|")?(blob:[^\s'")]+)(?:'|")?\s*\)/gi;
            while ((matches = regex.exec(csstext)) != null) rememberBlobURL(matches[1],"image/png");
        }
        else if (element.localName == "link" && (element.rel.toLowerCase() == "icon" || element.rel.toLowerCase() == "shortcut icon"))
        {
            if (element.href.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.href,"image/vnd.microsoft.icon");
        }
        else if (element.localName == "body")
        {
            if (element.background.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.background,"image/png");
        }
        else if (element.localName == "img")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.src,"image/png");
        }
        else if (element.localName == "input" && element.type.toLowerCase() == "image")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.src,"image/png");
        }
        else if (element.localName == "audio")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.src,"audio/mpeg");
        }
        else if (element.localName == "video")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.src,"video/mp4");
            if (element.poster.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.poster,"image/png");
        }
        else if (element.localName == "source")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:")
            {
                if (element.parentElement.localName == "audio") rememberBlobURL(element.src,"audio/mpeg","");
                else if (element.parentElement.localName == "video") rememberBlobURL(element.src,"video/mp4","");
            }
        }
        else if (element.localName == "track")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.src,"text/vtt");
        }
        else if (element.localName == "object")
        {
            if (element.data.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.data,"application/octet-stream");
        }
        else if (element.localName == "embed")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") rememberBlobURL(element.src,"application/octet-stream");
        }
        
        /* Handle nested frames and child elements */
        
        if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
        {
            try
            {
                if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before finding */
                {
                    if (depth < maxFrameDepth)
                    {
                        findBlobResources(depth+1,element.contentWindow,element.contentDocument.documentElement);
                    }
                }
            }
            catch (e) {}  /* attempting cross-domain web page access */
        }
        else
        {
            for (i = 0; i < element.children.length; i++)
                if (element.children[i] != null)  /* in case web page not fully loaded before finding */
                    findBlobResources(depth,frame,element.children[i]);
        }
    }
    
    function rememberBlobURL(bloburl,mimetype)
    {
        var i;
        
        for (i = 0; i < resourceBlobURL.length; i++)
            if (resourceBlobURL[i] == bloburl) break;
        
        if (i == resourceBlobURL.length)  /* new blob */
        {
            resourceBlobURL[i] = bloburl;
            resourceMimeType[i] = mimetype;  /* default if load fails */
            resourceBase64Data[i] = "";  /* default if load fails */
            resourceStatus[i] = "pending";
            resourceRemembered[i] = 1;
        }
        else resourceRemembered[i]++;  /* repeated blob */
    }
    
    /* Load blob resources - after first pass */
    
    function loadBlobResources()
    {
        var i,xhr;
        
        resourceCount = 0;
        
        for (i = 0; i < resourceBlobURL.length; i++)
        {
            if (resourceStatus[i] == "pending") 
            {
                resourceCount++;
                
                try
                {
                    xhr = new XMLHttpRequest();
                    
                    xhr.open("GET",resourceBlobURL[i],true);
                    xhr.setRequestHeader("Cache-Control","no-store");
                    xhr.responseType = "arraybuffer";
                    xhr.timeout = 1000;
                    xhr._resourceIndex = i;
                    xhr.onload = loadSuccess;
                    xhr.onerror = loadFailure;
                    xhr.ontimeout = loadFailure;
                    
                    xhr.send();  /* throws exception if url is invalid */
                }
                catch(e)
                {
                    resourceStatus[i] = "failure";
                    
                    --resourceCount;
                }
            }
        }
        
        if (resourceCount <= 0) substituteBlobResources();
    }
    
    function loadSuccess()
    {
        var i,binaryString,contentType,mimetype;
        var byteArray = new Uint8Array(this.response);
        var matches = new Array();
        
        if (this.status == 200)
        {
            binaryString = "";
            for (i = 0; i < byteArray.byteLength; i++) binaryString += String.fromCharCode(byteArray[i]);
            
            contentType = this.getResponseHeader("Content-Type");
            if (contentType == null) contentType = "";
            
            matches = contentType.match(/([^;]+)/i);
            if (matches != null) mimetype = matches[1].toLowerCase();
            else mimetype = "";
            
            if (mimetype != "") resourceMimeType[this._resourceIndex] = mimetype;
            
            resourceBase64Data[this._resourceIndex] = btoa(binaryString);
            
            resourceStatus[this._resourceIndex] = "success";
        }
        else resourceStatus[this._resourceIndex] = "failure";
        
        if (--resourceCount <= 0) substituteBlobResources();
    }
    
    function loadFailure()
    {
        resourceStatus[this._resourceIndex] = "failure";
        
        if (--resourceCount <= 0) substituteBlobResources();
    }
    
    /* Second Pass - to substitute blob URL's with data URI's */
    
    function substituteBlobResources()
    {
        var i,dataurisize,skipcount,failcount,count,script;
        
        /* Check for large resource sizes */
        
        dataurisize = 0;
        skipcount = 0;
        
        for (i = 0; i < resourceBlobURL.length; i++)
        {
            count = resourceRemembered[i];
            
            if (resourceBase64Data[i].length*count > maxResourceSize*1024*1024) skipcount++;  /* skip large and/or repeated resource */
            else dataurisize += resourceBase64Data[i].length*count;
        }
        
        if (dataurisize > 200*1024*1024)  /* 200MB */
        {
            alert("Cannot remove page loader because the total size of resources exceeds 200MB.\n\n" +
                  "Try this suggestion:\n\n" +
                  "  • Reduce the 'Maximum size allowed for a resource' option value.\n\n");
                  
            chrome.runtime.sendMessage({ type: "setSaveBadge", text: "", color: "#000000" });
            
            return;
        }
        
        if (skipcount > 0)
        {
            if (!confirm(skipcount + " resources exceed maximum size and will be discarded.\n\n" +
                  "Try this suggestion:\n\n" +
                  "  • Reduce the 'Maximum size allowed for a resource' option value.\n\n"))
            {
                chrome.runtime.sendMessage({ type: "setSaveBadge", text: "", color: "#000000" });
                
                return;
            }
        }
        
        /* Remove page loader script */
        
        script = document.getElementById("savepage-pageloader");
        script.parentElement.removeChild(script);
        
        /* Release blob memory allocation */
        
        for (i = 0; i < resourceBlobURL.length; i++) 
            window.URL.revokeObjectURL(resourceBlobURL[i]);
        
        /* Replace blob URL's with data URI's */
        
        replaceBlobResources(0,window,document.documentElement);  /* replace blob url's with data uri's */
        
        savedPageLoader = false;
        
        chrome.runtime.sendMessage({ type: "setSaveBadge", text: "", color: "#000000" });
    }
    
    function replaceBlobResources(depth,frame,element)
    {
        var i,csstext,regex;
        
        if (element.hasAttribute("style"))
        {
            csstext = element.style.cssText;
            regex = /url\(\s*(?:'|")?(blob:[^\s'")]+)(?:'|")?\s*\)/gi;
            element.style.cssText = csstext.replace(regex,replaceCSSBlobURL);
        }
        
        if (element.localName == "style")
        {
            csstext = element.textContent;
            regex = /url\(\s*(?:'|")?(blob:[^\s'")]+)(?:'|")?\s*\)/gi;
            element.textContent = csstext.replace(regex,replaceCSSBlobURL);
        }
        else if (element.localName == "link" && (element.rel.toLowerCase() == "icon" || element.rel.toLowerCase() == "shortcut icon"))
        {
            if (element.href.substr(0,5).toLowerCase() == "blob:") element.href = replaceBlobURL(element.href);
        }
        else if (element.localName == "body")
        {
            if (element.background.substr(0,5).toLowerCase() == "blob:") element.background = replaceBlobURL(element.background);
        }
        else if (element.localName == "img")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") element.src = replaceBlobURL(element.src);
        }
        else if (element.localName == "input" && element.type.toLowerCase() == "image")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") element.src = replaceBlobURL(element.src);
        }
        else if (element.localName == "audio")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:")
            {
                element.src = replaceBlobURL(element.src);
                element.load();
            }
        }
        else if (element.localName == "video")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:")
            {
                element.src = replaceBlobURL(element.src);
                element.load();
            }
            if (element.poster.substr(0,5).toLowerCase() == "blob:") element.poster = replaceBlobURL(element.poster);
        }
        else if (element.localName == "source")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:")
            {
                element.src = replaceBlobURL(element.src);
                element.parentElement.load();
            }
        }
        else if (element.localName == "track")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") element.src = replaceBlobURL(element.src);
        }
        else if (element.localName == "object")
        {
            if (element.data.substr(0,5).toLowerCase() == "blob:") element.data = replaceBlobURL(element.data);
        }
        else if (element.localName == "embed")
        {
            if (element.src.substr(0,5).toLowerCase() == "blob:") element.src = replaceBlobURL(element.src);
        }
        
        /* Handle nested frames and child elements */
        
        if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
        {
            try
            {
                if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before replacing */
                {
                    if (depth < maxFrameDepth)
                    {
                        replaceBlobResources(depth+1,element.contentWindow,element.contentDocument.documentElement);
                    }
                }
            }
            catch (e) {}  /* attempting cross-domain web page access */
        }
        else
        {
            for (i = 0; i < element.children.length; i++)
                if (element.children[i] != null)  /* in case web page not fully loaded before replacing */
                    replaceBlobResources(depth,frame,element.children[i]);
        }
    }
    
    function replaceCSSBlobURL(match,p1,offset,string)
    {
        return "url(" + replaceBlobURL(p1) + ")";
    }
    
    function replaceBlobURL(bloburl)
    {
        var i,count;
        
        for (i = 0; i < resourceBlobURL.length; i++)
            if (resourceBlobURL[i] == bloburl && resourceStatus[i] == "success") break;
        
        if (i < resourceBlobURL.length)
        {
            count = resourceRemembered[i];
            
            if (resourceBase64Data[i].length*count > maxResourceSize*1024*1024) return bloburl;  /* skip large and/or repeated resource */
            
            return "data:" + resourceMimeType[i] + ";base64," + resourceBase64Data[i];  /* binary data encoded as Base64 ASCII string */
        }
        
        return bloburl;
    }
}

/************************************************************************/

/* Extract saved page media (image/audio/video) function */

function extractSavedPageMedia(srcurl)
{
    chrome.runtime.sendMessage({ type: "setSaveBadge", text: "EXT", color: "#00A000" });
    
    if (!extract(0,window,document.documentElement)) alert("Image/Audio/Video element not found.");
    
    chrome.runtime.sendMessage({ type: "setSaveBadge", text: "", color: "#000000" });
    
    function extract(depth,frame,element)
    {
        var i,baseuri,location,mediaURL,filename,datestr,link;
        var pathsegments = new Array();
        var date = new Date();
        
        if (element.localName == "img" || element.localName == "audio" || element.localName == "video" || element.localName == "source")
        {
            if (element.src == srcurl)  /* image/audio/video found */
            {
                baseuri = element.ownerDocument.baseURI;
                
                if (baseuri != null)
                {
                    location = resolveURL(element.getAttribute("data-savepage-src"),baseuri);
                    
                    mediaURL = new URL(location,"about:blank");
                    
                    if (location != null)
                    {
                        pathsegments = mediaURL.pathname.split("/");
                        filename = pathsegments.pop();
                        if (filename == "") filename = pathsegments.pop();
                        
                        filename = decodeURIComponent(filename);
                        
                        if (prefixFileName) filename = "{" + mediaURL.hostname + "} " + filename;
                        
                        if (suffixFileName)
                        {
                            datestr = new Date(date.getTime()-(date.getTimezoneOffset()*60000)).toISOString();
                            datestr = datestr.substr(2,17);
                            datestr = datestr.replace(/T/," ");
                            datestr = datestr.replace(/:/g,"-");
                            
                            i = filename.lastIndexOf(".");
                            if (i < 0) filename = filename + " {" + datestr + "}";
                            else filename = filename.substring(0,i) +  " {" + datestr + "}" + filename.substring(i);
                        }
                        
                        link = document.createElement("a");
                        link.download = filename;
                        link.href = srcurl;
                        
                        document.body.appendChild(link);
                        
                        link.click();  /* save image/audio/video as file */
                        
                        return true;
                    }
                }
            }
        }
        
        /* Handle nested frames and child elements */
        
        if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
        {
            try
            {
                if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before extracting */
                {
                    if (depth < maxFrameDepth)
                    {
                        if (extract(depth+1,element.contentWindow,element.contentDocument.documentElement)) return true;
                    }
                }
            }
            catch (e) {}  /* attempting cross-domain web page access */
        }
        else
        {
            for (i = 0; i < element.children.length; i++)
                if (element.children[i] != null)  /* in case web page not fully loaded before extracting */
                    if (extract(depth,frame,element.children[i])) return true;
        }
        
        return false;
    }
}

/************************************************************************/
