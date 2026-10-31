# Reads the text and its position on page images with the OCR built into Windows 10/11
# (Windows.Media.Ocr), for papers that have no text layer (maths). tools/shot-boxes.py
# runs it. Prints one JSON object per image:
#   {"file": ..., "w": width, "h": height, "lines": [{"x0","y0","x1","y1","text","words"}]}
# with positions in pixels of the image.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/ocr-pages.ps1 <image> [<image> ...]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Paths)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
foreach ($path in $Paths) {
    $full = (Resolve-Path $path).Path
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    # Twice the size reads short labels such as "Q2." that the page's own size misses.
    $k = 2
    $transform = New-Object Windows.Graphics.Imaging.BitmapTransform
    $transform.ScaledWidth = $decoder.PixelWidth * $k
    $transform.ScaledHeight = $decoder.PixelHeight * $k
    $transform.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Cubic
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
        [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $transform,
        [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation,
        [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines = @()
    foreach ($line in $result.Lines) {
        $words = @($line.Words)
        $rects = $words | ForEach-Object { $_.BoundingRect }
        $lines += [ordered]@{
            x0 = ($rects | ForEach-Object { $_.X } | Measure-Object -Minimum).Minimum / $k
            y0 = ($rects | ForEach-Object { $_.Y } | Measure-Object -Minimum).Minimum / $k
            x1 = ($rects | ForEach-Object { $_.X + $_.Width } | Measure-Object -Maximum).Maximum / $k
            y1 = ($rects | ForEach-Object { $_.Y + $_.Height } | Measure-Object -Maximum).Maximum / $k
            text = $line.Text
            words = @($words | ForEach-Object { $_.Text })
        }
    }
    $stream.Dispose()
    [ordered]@{ file = $path; w = $decoder.PixelWidth; h = $decoder.PixelHeight; lines = $lines } | ConvertTo-Json -Depth 5 -Compress
}
