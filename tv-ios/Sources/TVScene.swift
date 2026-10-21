import UIKit
import WebKit

// The TV: while Screen Mirroring (or AirPlay, or a cable) is on, iOS gives Sour Player TV the TV as a screen
// of its own. It shows the party there, big and without buttons, and follows the phone when a party starts
// or ends.
class TVSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var web: WKWebView?
    private var shown: String?
    private var pulse: Timer?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        let controller = UIViewController()
        controller.view.backgroundColor = UIColor(red: 0.043, green: 0.043, blue: 0.059, alpha: 1)
        let web = WKWebView(frame: controller.view.bounds, configuration: Shared.webConfiguration())
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false
        web.backgroundColor = controller.view.backgroundColor
        web.scrollView.isScrollEnabled = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        controller.view.addSubview(web)
        window.rootViewController = controller
        window.isHidden = false
        self.window = window
        self.web = web
        NotificationCenter.default.addObserver(self, selector: #selector(partyChanged), name: .sourPartyChanged, object: nil)
        partyChanged()
        // iOS treats the TV's page like a background page (slow timers, a live connection that stalls):
        // nudge it every second so the song, progress and lyrics keep moving
        pulse = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.web?.evaluateJavaScript("window.tvPulse && window.tvPulse()", completionHandler: nil)
        }
    }

    @objc private func partyChanged() {
        DispatchQueue.main.async {
            guard let base = Shared.hermes else { return }
            let code = Shared.partyCode ?? "none"
            if code == self.shown { return }
            self.shown = code
            var address = base.absoluteString + "/tv/?screen=" + code
            if let auth = Shared.partyAuth, !auth.isEmpty,
               let a = auth.addingPercentEncoding(withAllowedCharacters: .alphanumerics) {
                address += "&a=" + a
            }
            if let url = URL(string: address) {
                self.web?.load(URLRequest(url: url))
            }
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        NotificationCenter.default.removeObserver(self)
        pulse?.invalidate()
        pulse = nil
        web = nil
        window = nil
    }
}
