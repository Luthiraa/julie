import { exec } from 'node:child_process';

// Helper to run JXA
function runJXA(code: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // Escape single quotes for the shell command wrapper? 
        // Better to use spawn or specific exec quoting, but strictly JXA 
        // often fits in -e "..." if we are careful. 
        // Actually, passing via stdin is safer for multiline code.

        const child = exec('osascript -l JavaScript', (error, stdout, stderr) => {
            if (error) {
                reject(error.message + "\n" + stderr);
            } else {
                resolve(stdout.trim());
            }
        });

        if (child.stdin) {
            child.stdin.write(code);
            child.stdin.end();
        }
    });
}

export const ComputerAction = {
    async mouseMove(x: number, y: number) {
        const code = `
            ObjC.import('CoreGraphics');
            var point = $.CGPointMake(${x}, ${y});
            var event = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft);
            $.CGEventPost($.kCGHIDEventTap, event);
        `;
        return runJXA(code);
    },

    async leftClick(x: number, y: number) {
        // Move then click
        const code = `
            ObjC.import('CoreGraphics');
            var point = $.CGPointMake(${x}, ${y});
            
            var move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft);
            $.CGEventPost($.kCGHIDEventTap, move);
            delay(0.1);

            var down = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, $.kCGMouseButtonLeft);
            $.CGEventPost($.kCGHIDEventTap, down);
            
            var up = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, $.kCGMouseButtonLeft);
            $.CGEventPost($.kCGHIDEventTap, up);
        `;
        return runJXA(code);
    },

    async rightClick(x: number, y: number) {
        const code = `
            ObjC.import('CoreGraphics');
            var point = $.CGPointMake(${x}, ${y});
            
            var move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft);
            $.CGEventPost($.kCGHIDEventTap, move);
            delay(0.1);

            var down = $.CGEventCreateMouseEvent(null, $.kCGEventRightMouseDown, point, $.kCGMouseButtonRight);
            $.CGEventPost($.kCGHIDEventTap, down);
            
            var up = $.CGEventCreateMouseEvent(null, $.kCGEventRightMouseUp, point, $.kCGMouseButtonRight);
            $.CGEventPost($.kCGHIDEventTap, up);
        `;
        return runJXA(code);
    },

    async doubleClick(x: number, y: number) {
        const code = `
            ObjC.import('CoreGraphics');
            var point = $.CGPointMake(${x}, ${y});
            
            var move = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft);
            $.CGEventPost($.kCGHIDEventTap, move);
            
            // Click 1
            var down1 = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, $.kCGMouseButtonLeft);
            $.CGEventPost($.kCGHIDEventTap, down1);
            var up1 = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, $.kCGMouseButtonLeft);
            $.CGEventPost($.kCGHIDEventTap, up1);
            
            // Click 2 (Set click count needed? CGEventSetIntegerValueField(event, kCGMouseEventClickState, 2))
            // JXA approach for clicks is tricky. Simple double approach usually works.
            
            var down2 = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, point, $.kCGMouseButtonLeft);
            $.CGEventSetIntegerValueField(down2, $.kCGMouseEventClickState, 2);
            $.CGEventPost($.kCGHIDEventTap, down2);
            
            var up2 = $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, point, $.kCGMouseButtonLeft);
            $.CGEventSetIntegerValueField(up2, $.kCGMouseEventClickState, 2);
            $.CGEventPost($.kCGHIDEventTap, up2);
        `;
        return runJXA(code);
    },

    async drag(startX: number, startY: number, endX: number, endY: number) {
        const code = `
            ObjC.import('CoreGraphics');
            var start = $.CGPointMake(${startX}, ${startY});
            var end = $.CGPointMake(${endX}, ${endY});
            
            // Move to Start
            $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, start, $.kCGMouseButtonLeft));
            delay(0.1);
            
            // Down
            $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDown, start, $.kCGMouseButtonLeft));
            delay(0.1);
            
            // Drag to End (LeftMouseDragged)
            $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseDragged, end, $.kCGMouseButtonLeft));
            delay(0.2);
            
            // Up
            $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateMouseEvent(null, $.kCGEventLeftMouseUp, end, $.kCGMouseButtonLeft));
        `;
        return runJXA(code);
    },

    async scroll(x: number, y: number, scrollY: number) {
        // Optionally move mouse first?
        // Scroll event: kCGEventScrollWheel
        const code = `
            ObjC.import('CoreGraphics');
            // Move mouse first so we scroll the right thing
            var point = $.CGPointMake(${x}, ${y});
            $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft));
            delay(0.1);
            
            // Create Scroll Event
            // 2nd arg: Units (lines), 3rd arg: DeltaY (negative is down usually?)
            var event = $.CGEventCreateScrollWheelEvent(null, $.kCGScrollEventUnitLine, 1, ${scrollY});
            $.CGEventPost($.kCGHIDEventTap, event);
         `;
        return runJXA(code);
    },

    async getScreenSize() {
        // Uses System Events or CoreGraphics
        const code = `
            ObjC.import('CoreGraphics');
            var rect = $.CGDisplayBounds($.CGMainDisplayID());
            JSON.stringify({width: rect.size.width, height: rect.size.height})
        `;
        const res = await runJXA(code);
        return JSON.parse(res);
    },

    async getCursorPosition() {
        // Standard AppleScript is actually easier for this part?
        // Or JXA
        const code = `
            ObjC.import('CoreGraphics');
            var loc = $.CGEventGetLocation($.CGEventCreate(null));
            JSON.stringify({x: loc.x, y: loc.y})
        `;
        const res = await runJXA(code);
        return JSON.parse(res);
    }
};
