# Line protocol on stdin/stdout:
#   fg            -> handle of the foreground window
#   files <b64>   -> "ok" after the files (base64 of UTF-8 paths joined by "|") are on the clipboard
#   paste <hwnd>  -> "ok" after Ctrl+V was sent to that window, else "fail"
Add-Type -ReferencedAssemblies 'System', 'System.Windows.Forms' @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class QR {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

    const uint KEYUP = 2;
    static readonly int[] Modifiers = { 0x10, 0x11, 0x12, 0x5B, 0x5C };

    public static long Foreground() {
        // A hotkey with Alt leaves Chrome with a lone Alt press, which moves focus to the Chrome menu.
        // Another key press while Alt is down cancels that.
        if ((GetAsyncKeyState(0x12) & 0x8000) != 0) {
            keybd_event(0xE8, 0, 0, UIntPtr.Zero);
            keybd_event(0xE8, 0, KEYUP, UIntPtr.Zero);
        }
        return GetForegroundWindow().ToInt64();
    }

    // Puts files on the clipboard the way File Explorer does, so one Ctrl+V attaches all of them.
    public static bool SetFiles(string[] paths) {
        bool ok = false;
        Thread thread = new Thread(() => {
            try {
                var list = new System.Collections.Specialized.StringCollection();
                list.AddRange(paths);
                System.Windows.Forms.Clipboard.SetFileDropList(list);
                ok = true;
            } catch {}
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        return ok;
    }

    static bool ModifierDown() {
        foreach (int vk in Modifiers) if ((GetAsyncKeyState(vk) & 0x8000) != 0) return true;
        return false;
    }

    public static bool Paste(long target) {
        IntPtr h = new IntPtr(target);
        if (target == 0 || !IsWindow(h)) return false;

        // A held hotkey modifier would turn Ctrl+V into another shortcut.
        for (int i = 0; i < 75 && ModifierDown(); i++) Thread.Sleep(20);
        if (ModifierDown()) return false;

        for (int i = 0; i < 25 && GetForegroundWindow() != h; i++) {
            SetForegroundWindow(h);
            Thread.Sleep(20);
        }
        if (GetForegroundWindow() != h) return false;

        keybd_event(0x11, 0, 0, UIntPtr.Zero);
        keybd_event(0x56, 0, 0, UIntPtr.Zero);
        keybd_event(0x56, 0, KEYUP, UIntPtr.Zero);
        keybd_event(0x11, 0, KEYUP, UIntPtr.Zero);
        return true;
    }
}
"@

while ($null -ne ($line = [Console]::In.ReadLine())) {
    $parts = $line.Trim().Split(' ')
    $result = 'fail'
    try {
        if ($parts[0] -eq 'fg') { $result = [QR]::Foreground().ToString() }
        elseif ($parts[0] -eq 'files') {
            $paths = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($parts[1])).Split('|')
            if ([QR]::SetFiles($paths)) { $result = 'ok' }
        }
        elseif ($parts[0] -eq 'paste') { if ([QR]::Paste([long]$parts[1])) { $result = 'ok' } }
    } catch {}
    [Console]::Out.WriteLine($result)
    [Console]::Out.Flush()
}
