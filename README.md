# Recoll WE Browser Extension for Google Chrome, Using A Web Service

The [Recoll WE Firefox extension](https://addons.mozilla.org/en-US/firefox/addon/recoll-we/) "indexes Firefox visited pages with [Recoll](https://www.lesbonscomptes.com/recoll/)."   The extension does this by downloading temporary copies of each web page visited which the Recoll indexing engine then periodically processes into its index.

The problem that this version of the extension tries to solve is that the existing process results in two files being added to the browser's downloads menu and progress bar every time a new every web page is opened.  This process is somewhat "noisy" and I'd prefer it to be more invisible.   In this version of the extension I have changed the process so that the extension now sends the content of its two files for each web page it opens to a local web service.  That web service then writes those files to disk.  From there indexing by the Recoll indexing engine continues as it normally would.  Using this method avoids adding anything to the browser's download list or to the download progress bar.  The process is now essentially invisible.

Since I use this extension on Google Chrome, that's how it is packaged in this project.  I expect it will also work on Firefox but I have not tested or packaged it for that browser.  Instead I have shared code with the extension's owner that would allow his Firefox extension to be modified to support Google Chrome if he wants to do that, using its existing file download process.

To use my version of the extension it must be installed into the browser manually.  It is not available from the Chrome web store.  Download the <code>recoll-we-using-webservice.crx</code> file that can be found in the Releases tab of this project drop it onto the Extensions page in the browser to install it.  In addition to installing the extension, the web service, a python script, must be running in the background on the workstation.  Download the <code>recoll-we-webservice.py</code> file found in the Releases tab of this project.

The Python script is run on the workstation under your userid so that it has access to your Recoll webqueuedir directory (<code>~/.recoll/ToIndex</code> by default.) To run the script do:

<pre>FLASK_APP=/path/to/recoll-we-webservice.py python -m flask run &</pre>

Add the <code>-p ####</code> option after <code>run</code> to use a port other than 5000 for the web service.  A corresponding option has been added to the extension's settings page to tell the extension what port number it should use to connect to the web service. 

The script requires the [Flask web framework](https://flask.palletsprojects.com/) module for Python. On Fedora Linux, where I live, <code>sudo dnf install python3-flask</code> installs this module.  I expect that other Linux distributions have similar install packages and commands.

The web service script writes a log file at <code>/tmp/recoll-we-webservice.log</code>.  It rotates that log file automatically when it reaches 250KB in size.
