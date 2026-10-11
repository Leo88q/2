// Copyright 2015 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Helper class that allows us to modify our app, based on FPLActivity

package game.piegeddon.native;

import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.res.Resources;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup.LayoutParams;
import android.view.WindowManager;
import com.google.android.gms.analytics.GoogleAnalytics;
import com.google.android.gms.analytics.HitBuilders;
import com.google.android.gms.analytics.Tracker;
import com.google.fpl.fplbase.FPLActivity;

public class PieNoonActivity extends FPLActivity {
  private final String PROPERTY_ID = "XX-XXXXXXXX-X";
  private Tracker tracker = null;
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    tracker = GoogleAnalytics.getInstance(this).newTracker(PROPERTY_ID);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  }

  public void SendTrackerEvent(String category, String action) {
    tracker.send(new HitBuilders.EventBuilder()
             .setCategory(category)
             .setAction(action)
             .build());
  }

  public void SendTrackerEvent(String category, String action, String label) {
    tracker.send(new HitBuilders.EventBuilder()
           .setCategory(category)
           .setAction(action)
           .setLabel(label)
           .build());
  }

  public void SendTrackerEvent(String category, String action, String label, int value) {
    tracker.send(new HitBuilders.EventBuilder()
           .setCategory(category)
           .setAction(action)
           .setLabel(label)
           .setValue(value)
           .build());
  }

  // TODO: Expose this as the JNI function and delete the separate Len() and
  //       Get() functions below.
  private String[] StringArrayResource(String resource_name) {
    try {
      Resources res = getResources();
      int id = res.getIdentifier(resource_name, "array", getPackageName());
      return res.getStringArray(id);

    } catch (Exception e) {
      Log.e("SDL", "exception", e);
      return new String[0];
    }
  }

  public int LenStringArrayResource(String resource_name) {
    return StringArrayResource(resource_name).length;
  }

  public String GetStringArrayResource(String resource_name, int index) {
    return StringArrayResource(resource_name)[index];
  }

  public void LaunchZooshiSanta() {
    // Removed in Piegeddon fork: cross-promotion of a third-party product
    // is not allowed under our trademark policy (see LICENSE-COMPLIANCE.md).
  }
}

