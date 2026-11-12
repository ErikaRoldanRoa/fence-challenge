"""The installed Google Chrome for the cube lab's test, started here rather than by Playwright.

Playwright's launch(channel="chrome") gives Chrome its own pipes (its output, and the DevTools pipe on descriptors 3 and 4).
Chrome starts Google's updater, which inherits them, so closing the browser waited for an end of file that came only once
the updater was done (about half an hour after the last check). Ending the updater would switch off Chrome's security
updates: never. Started here instead, Chrome writes to /dev/null, Playwright reaches it over its DevTools port, and closing
the browser ends Chrome's own process (never its group: the updater lives on), waited on as a process; a test that stops
before closing it (an error, a SIGTERM) ends it at exit, as Playwright's own launch did.

The arguments are those Playwright 1.58 gives a headless launch of the "chrome" channel (driver/package/lib/server/chromium/
chromiumSwitches.js and chromium.js), so that a page behaves as it did.

    import chrome
    browser = chrome.launch(p, args=["--use-angle=swiftshader"])   # p: sync_playwright()
    ...
    browser.close()                                                # ends Chrome
"""
import atexit
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

CHROME = os.environ.get("FC_CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
FEATURES_OFF = ("AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,"
                "DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,"
                "ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints")
SWITCHES = [   # chromiumSwitches(assistantMode=false, channel="chrome", android=false), in its order
    "--disable-field-trial-config", "--disable-background-networking", "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows", "--disable-back-forward-cache", "--disable-breakpad",
    "--disable-client-side-phishing-detection", "--disable-component-extensions-with-background-pages",
    "--disable-component-update", "--no-default-browser-check", "--disable-default-apps", "--disable-dev-shm-usage",
    "--disable-extensions", "--disable-features=" + FEATURES_OFF, "--enable-features=CDPScreenshotNewSurface",
    "--allow-pre-commit-input", "--disable-hang-monitor", "--disable-ipc-flooding-protection", "--disable-popup-blocking",
    "--disable-prompt-on-repost", "--disable-renderer-backgrounding", "--force-color-profile=srgb",
    "--metrics-recording-only", "--no-first-run", "--password-store=basic", "--use-mock-keychain", "--no-service-autorun",
    "--export-tagged-pdf", "--disable-search-engine-choice-screen", "--unsafely-disable-devtools-self-xss-warnings",
    "--edge-skip-compat-layer-relaunch", "--enable-automation", "--disable-infobars", "--disable-search-engine-choice-screen",
    "--disable-sync",
]
HEADLESS = ["--headless", "--hide-scrollbars", "--mute-audio",
            "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4"]
LIVE = {}   # pid: (process, profile), each Chrome started here and not yet ended


class Chrome:
    """Playwright's Browser over CDP, and the Chrome process behind it: close() closes both."""

    def __init__(self, browser, proc, profile):
        self._browser, self._proc, self._profile = browser, proc, profile

    def __getattr__(self, name):
        return getattr(self._browser, name)

    def close(self, *a, **k):
        try:
            self._browser.close(*a, **k)
        finally:
            end(self._proc, self._profile)


def end(proc, profile):
    """Chrome's own process, never its group, ended and waited on as a process; its profile folder removed."""
    try:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=15)
    finally:
        LIVE.pop(proc.pid, None)
        shutil.rmtree(profile, ignore_errors=True)


@atexit.register
def end_all():
    """A test that stopped before closing its browser (an error, a SIGTERM): its Chrome ended too, as Playwright's own
    launch did; only the processes started here."""
    for proc, profile in list(LIVE.values()):
        end(proc, profile)


if threading.current_thread() is threading.main_thread() and signal.getsignal(signal.SIGTERM) is signal.SIG_DFL:
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(128 + signal.SIGTERM))   # so that end_all runs


def launch(p, args=(), headless=True):
    """Google Chrome started here (output to /dev/null), Playwright connected to it over its DevTools port."""
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    profile = tempfile.mkdtemp(prefix="fc-cube-chrome-")
    cmd = ([CHROME] + SWITCHES + ["--enable-unsafe-swiftshader"] + (HEADLESS if headless else []) + ["--no-sandbox"]
           + list(args) + [f"--user-data-dir={profile}", f"--remote-debugging-port={port}", "--no-startup-window"])
    proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    LIVE[proc.pid] = (proc, profile)
    url = f"http://127.0.0.1:{port}"
    until = time.time() + 30
    while True:
        try:
            with urllib.request.urlopen(url + "/json/version", timeout=2) as r:
                r.read()
            break
        except OSError:
            if proc.poll() is not None or time.time() > until:
                end(proc, profile)
                raise RuntimeError("Google Chrome did not start: its DevTools port never answered")
            time.sleep(0.1)
    try:
        browser = p.chromium.connect_over_cdp(url)
    except Exception:
        end(proc, profile)
        raise
    return Chrome(browser, proc, profile)
