import UIKit
import WebKit

// The TV: while Screen Mirroring (or AirPlay, or a cable) is on, iOS gives Sour Player TV the TV as a screen
// of its own. It shows the party there, big and without buttons, and follows the phone when a party starts
// or ends.
class TVSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var web: WKWebView?
    private var shown: String?

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
    }

    @objc private func partyChanged() {
        DispatchQueue.main.async {
            guard let base = Shared.hermes else { return }
            let code = Shared.partyCode ?? "none"
            if code == self.shown { return }
            self.shown = code
            if let url = URL(string: base.absoluteString + "/tv/?screen=" + code) {
                self.web?.load(URLRequest(url: url))
            }
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        NotificationCenter.default.removeObserver(self)
        web = nil
        window = nil
    }
}
