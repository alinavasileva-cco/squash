import SwiftUI
import WebKit
import UIKit

@main
struct SquashHubApp: App {
    var body: some Scene {
        WindowGroup {
            SquashWebView()
                .ignoresSafeArea(edges: .bottom)
        }
    }
}

private let squashURL = URL(string: "https://alinavasileva-cco.github.io/squash/")!

struct SquashWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "backup")
        controller.addUserScript(WKUserScript(source: """
            document.addEventListener('click', function(event) {
                const a = event.target.closest('a[download]');
                if (!a || !a.href.startsWith('blob:')) return;
                event.preventDefault();
                fetch(a.href).then(r => r.blob()).then(blob => {
                    const reader = new FileReader();
                    reader.onload = function() {
                        window.webkit.messageHandlers.backup.postMessage({
                            filename: a.download || 'squash-hub-backup.json',
                            dataURL: String(reader.result || '')
                        });
                    };
                    reader.readAsDataURL(blob);
                }).catch(() => {});
            }, true);
        """, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController = controller
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = context.coordinator
        web.backgroundColor = UIColor(red: 0.969, green: 0.969, blue: 0.953, alpha: 1)
        web.isOpaque = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = true
        web.load(URLRequest(url: squashURL, cachePolicy: .reloadRevalidatingCacheData))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            let sameSite = url.scheme == "https"
                && url.host == "alinavasileva-cco.github.io"
                && url.path.hasPrefix("/squash/")
            if sameSite || url.scheme == "about" || url.scheme == "blob" {
                decisionHandler(.allow)
            } else {
                if url.scheme == "https" {
                    UIApplication.shared.open(url)
                }
                decisionHandler(.cancel)
            }
        }

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.name == "backup",
                  let body = message.body as? [String: String],
                  let encoded = body["dataURL"],
                  encoded.hasPrefix("data:"),
                  let comma = encoded.firstIndex(of: ","),
                  let bytes = Data(base64Encoded: String(encoded[encoded.index(after: comma)...])),
                  bytes.count < 25_000_000 else { return }
            let fileName = "squash-hub-backup.json"
            let dest = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
            do {
                try bytes.write(to: dest, options: .atomic)
                DispatchQueue.main.async {
                    guard let scene = UIApplication.shared.connectedScenes
                            .compactMap({ $0 as? UIWindowScene }).first,
                          let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return }
                    let share = UIActivityViewController(activityItems: [dest], applicationActivities: nil)
                    if let popover = share.popoverPresentationController {
                        popover.sourceView = root.view
                        popover.sourceRect = CGRect(x: root.view.bounds.midX,
                                                    y: root.view.bounds.midY,
                                                    width: 1, height: 1)
                        popover.permittedArrowDirections = []
                    }
                    root.present(share, animated: true)
                }
            } catch {
                print("Could not export Squash Hub backup: \(error)")
            }
        }
    }
}
