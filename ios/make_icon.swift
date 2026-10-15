import AppKit
import Foundation

let size = 1024
guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil,
    pixelsWide: size, pixelsHigh: size,
    bitsPerSample: 8, samplesPerPixel: 4,
    hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0),
    let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fatalError("Could not create app icon")
}
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
NSColor(calibratedRed: 0.984, green: 0.890, blue: 0.157, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: size, height: size).fill()
NSColor(calibratedRed: 0.067, green: 0.071, blue: 0.065, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 177, y: 177, width: 670, height: 670)).fill()
NSColor(calibratedRed: 1, green: 0.901, blue: 0.0, alpha: 1).setFill()
NSBezierPath(ovalIn: NSRect(x: 395, y: 478, width: 60, height: 60)).fill()
NSBezierPath(ovalIn: NSRect(x: 570, y: 478, width: 60, height: 60)).fill()
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()
guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Could not create PNG icon")
}
let dest = URL(fileURLWithPath: CommandLine.arguments[1])
try FileManager.default.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
try png.write(to: dest)
print("Created Squash Hub iOS icon at \(dest.path)")
