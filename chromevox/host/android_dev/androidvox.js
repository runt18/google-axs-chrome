// Copyright 2012 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Android-specific code needed to integrate AndroidVox with
 * the accessibility framework in Android.
 *
 * @author clchen@google.com (Charles L. Chen)
 */
goog.provide('cvox.AndroidVox');

goog.require('cvox.ChromeVox');
goog.require('cvox.ChromeVoxUserCommands');

/**
 * @constructor
 */
cvox.AndroidVox = function() {
};
goog.exportSymbol('cvox.AndroidVox', cvox.AndroidVox);


// Returns true if the action was performed.
cvox.AndroidVox.performAction = function(actionJson) {
  // These are constants used by Android.
  var MOVEMENT_GRANULARITY_PAGE = 16;
  var MOVEMENT_GRANULARITY_PARAGRAPH = 8;
  var MOVEMENT_GRANULARITY_LINE = 4;
  var MOVEMENT_GRANULARITY_WORD = 2;
  var MOVEMENT_GRANULARITY_CHARACTER = 1;
  var ACTION_CLICK = 16;
  var ACTION_NEXT_AT_MOVEMENT_GRANULARITY = 256;
  var ACTION_NEXT_HTML_ELEMENT = 1024;
  var ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY = 512;
  var ACTION_PREVIOUS_HTML_ELEMENT = 2048;

  var FAKE_GRANULARITY_READ_CURRENT = -1;
  var FAKE_GRANULARITY_READ_TITLE = -2;
  var FAKE_GRANULARITY_STOP_SPEECH = -3;

  // The accessibility framework in Android will send commands to AndroidVox
  // using a JSON object that contains the action, granularity, and element
  // to use for navigation.
  var jsonObj =
      /** @type {{action, granularity, element}} */ (JSON.parse(actionJson));
  var action = jsonObj.action;
  var granularity = jsonObj.granularity;
  var htmlElementName = jsonObj.element;

  // This is a hack because of limitations in the Android framework; we're using
  // page and previous to mean reset ChromeVox. Note that ChromeVox will reset
  // automatically at the end of a page, so this is only needed if TalkBack is
  // trying to force a position reset.
  if ((granularity == MOVEMENT_GRANULARITY_PAGE) &&
      (action == ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY)) {
    cvox.ChromeVox.navigationManager.setReversed(false);
    cvox.ChromeVox.navigationManager.syncToPageBeginning();
    cvox.ChromeVox.navigationManager.updateIndicator();
  }

  // This is a hack; we're using page and next to mean readFromHere since
  // there is no clean way to do this in the API given how few calls are
  // available.
  if (granularity == MOVEMENT_GRANULARITY_PAGE) {
    cvox.ChromeVoxUserCommands.commands['readFromHere']();
    return true;
  }

  // Stop speech before doing anything else. Note that this will also stop
  // any continuous reading that may be happening.
  cvox.ChromeVoxUserCommands.commands['stopSpeech']();

  // Hack: Using fake granularities for commands. We were using NEXT_HTML, but
  // it is unsafe for TalkBack to do this since TalkBack has no way to check if
  // ChromeVox is actually active.
  if (granularity == FAKE_GRANULARITY_READ_CURRENT) {
    cvox.ChromeVoxUserCommands.finishNavCommand('');
    return true;
  }
  if (granularity == FAKE_GRANULARITY_READ_TITLE) {
    cvox.ChromeVoxUserCommands.commands.readCurrentTitle();
    return true;
  }
  if (granularity == FAKE_GRANULARITY_STOP_SPEECH) {
    // Speech was already stopped, nothing more to do.
    return true;
  }

  // Drop unknown fake granularities.
  if (granularity < 0) {
    return false;
  }

  // Default to Android line navigation / ChromeVox DOM object navigation.
  if (!granularity) {
    granularity = MOVEMENT_GRANULARITY_LINE;
  }

  // Adjust the granularity if needed
  var ANDROID_TO_CHROMEVOX_GRANULARITY_MAP = new Array();
  ANDROID_TO_CHROMEVOX_GRANULARITY_MAP[MOVEMENT_GRANULARITY_PARAGRAPH] =
      cvox.NavigationShifter.GRANULARITIES.GROUP;
  ANDROID_TO_CHROMEVOX_GRANULARITY_MAP[MOVEMENT_GRANULARITY_LINE] =
      cvox.NavigationShifter.GRANULARITIES.OBJECT;
  ANDROID_TO_CHROMEVOX_GRANULARITY_MAP[MOVEMENT_GRANULARITY_WORD] =
      cvox.NavigationShifter.GRANULARITIES.WORD;
  ANDROID_TO_CHROMEVOX_GRANULARITY_MAP[MOVEMENT_GRANULARITY_CHARACTER] =
      cvox.NavigationShifter.GRANULARITIES.CHARACTER;

  var targetNavStrategy = ANDROID_TO_CHROMEVOX_GRANULARITY_MAP[granularity];
  cvox.ChromeVox.navigationManager.setGranularity(targetNavStrategy);

  // Perform the action - return the NOT of it since the ChromeVoxUserCommands
  // return TRUE for using the default action (ie, ChromeVox was unable to
  // perform the action and is trying to let the default handler act).
  var actionPerformed = false;

  switch (action) {
    case ACTION_CLICK:
      // A click will always be dispatched; whether or not it actually does
      // anything useful is up to the page. There is no point in waiting for
      // a click and waiting would actually risk a potential lockup if
      // ChromeVox/the wrapper is removed before it can return.
      actionPerformed = true;
      window.setTimeout(function(){
            cvox.ChromeVoxUserCommands.commands['actOnCurrentItem']();
          }, 0);
      break;
    case ACTION_NEXT_HTML_ELEMENT:
    case ACTION_NEXT_AT_MOVEMENT_GRANULARITY:
      actionPerformed = !cvox.ChromeVoxUserCommands.commands.forward();
      break;
    case ACTION_PREVIOUS_HTML_ELEMENT:
    case ACTION_PREVIOUS_AT_MOVEMENT_GRANULARITY:
      actionPerformed = !cvox.ChromeVoxUserCommands.commands.backward();
      break;
  }
  return actionPerformed;
};
goog.exportSymbol('cvox.AndroidVox.performAction', cvox.AndroidVox.performAction);
