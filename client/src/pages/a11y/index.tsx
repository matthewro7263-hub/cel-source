import React from "react";
import { useA11y } from "@/lib/a11y-preferences";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function A11ySettings() {
  const { prefs, updatePrefs, isLoading } = useA11y();

  if (isLoading || !prefs) {
    return <div className="p-8">Loading accessibility settings...</div>;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Accessibility & Focus</h1>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-6">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Focus Mode</Label>
            <p className="text-sm text-muted-foreground">
              Hides sidebar nav items except current page, dims toolbars, increases content max-width.
            </p>
          </div>
          <Switch
            checked={!!prefs.focusMode}
            onCheckedChange={(checked) => updatePrefs({ focusMode: checked ? 1 : 0 })}
          />
        </div>

        <div className="flex items-center justify-between border-b pb-6">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">OpenDyslexic Font</Label>
            <p className="text-sm text-muted-foreground">
              Overrides site fonts with dyslexia-friendly alternatives.
            </p>
          </div>
          <Switch
            checked={!!prefs.dyslexia}
            onCheckedChange={(checked) => updatePrefs({ dyslexia: checked ? 1 : 0 })}
          />
        </div>

        <div className="flex items-center justify-between border-b pb-6">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Color-blind Safe Palette</Label>
            <p className="text-sm text-muted-foreground">
              Applies a safe palette filter to aid visibility.
            </p>
          </div>
          <Switch
            checked={!!prefs.colorblind}
            onCheckedChange={(checked) => updatePrefs({ colorblind: checked ? 1 : 0 })}
          />
        </div>

        <div className="flex items-center justify-between pb-6">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Reduced Motion</Label>
            <p className="text-sm text-muted-foreground">
              Disables animations and transitions.
            </p>
          </div>
          <Switch
            checked={!!prefs.reducedMotion}
            onCheckedChange={(checked) => updatePrefs({ reducedMotion: checked ? 1 : 0 })}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-6">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Large Touch Targets</Label>
            <p className="text-sm text-muted-foreground">
              Expands compact controls for tablet and couch review workflows.
            </p>
          </div>
          <Switch
            checked={!!prefs.largeTouch}
            onCheckedChange={(checked) => updatePrefs({ largeTouch: checked ? 1 : 0 })}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-6">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Audio Cues</Label>
            <p className="text-sm text-muted-foreground">
              Plays a short local chime when completion or error toasts appear.
            </p>
          </div>
          <Switch
            checked={!!prefs.audioCues}
            onCheckedChange={(checked) => updatePrefs({ audioCues: checked ? 1 : 0 })}
          />
        </div>
      </div>
    </div>
  );
}
