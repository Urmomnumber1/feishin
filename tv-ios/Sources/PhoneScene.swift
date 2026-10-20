import UIKit
import WebKit

// The phone: Hermes Music's /tv/ page, full screen
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = PhoneViewController()
        window.makeKeyAndVisible()
        self.window = window
    }

    // the phone is on the TV: it must not lock itself
    func sceneDidBecomeActive(_ scene: UIScene) { UIApplication.shared.isIdleTimerDisabled = true }
    func sceneWillResignActive(_ scene: UIScene) { UIApplication.shared.isIdleTimerDisabled = false }
}

class PhoneViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.043, green: 0.043, blue: 0.059, alpha: 1)
        let config = Shared.webConfiguration()
        config.userContentController.add(self, name: "sourtv")
        web = WKWebView(frame: view.bounds, configuration: config)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false
        web.backgroundColor = view.backgroundColor
        web.scrollView.backgroundColor = view.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = self
        web.uiDelegate = self
        view.addSubview(web)
        // three fingers held down: change the Hermes Music address
        let hold = UILongPressGestureRecognizer(target: self, action: #selector(askAddress))
        hold.numberOfTouchesRequired = 3
        hold.minimumPressDuration = 1.2
        view.addGestureRecognizer(hold)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if web.url == nil { open() }
    }

    private func open() {
        guard let base = Shared.hermes, let url = URL(string: base.absoluteString + "/tv/") else { return askAddress() }
        web.load(URLRequest(url: url))
    }

    @objc private func askAddress() {
        if presentedViewController != nil { return }
        let alert = UIAlertController(title: "Hermes Music address",
                                      message: "The address you open Hermes Music with, like 100.69.236.80:3340 or umbrel.local:3340.",
                                      preferredStyle: .alert)
        alert.addTextField { field in
            field.placeholder = "umbrel.local:3340"
            field.text = Shared.hermes?.absoluteString
            field.keyboardType = .URL
            field.autocapitalizationType = .none
            field.autocorrectionType = .no
        }
        alert.addAction(UIAlertAction(title: "Open", style: .default) { [weak self] _ in
            guard let url = Shared.normalize(alert.textFields?.first?.text ?? "") else { self?.askAddress(); return }
            Shared.hermes = url
            self?.open()
        })
        present(alert, animated: true)
    }

    // the page says which party is on (or none)
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body as? [String: Any]
        Shared.partyCode = body?["code"] as? String
    }

    // Hermes Music didn't answer: try again or fix the address
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let alert = UIAlertController(title: "Can't reach Hermes Music", message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Try again", style: .default) { [weak self] _ in self?.open() })
        alert.addAction(UIAlertAction(title: "Change address", style: .default) { [weak self] _ in self?.askAddress() })
        present(alert, animated: true)
    }

    // the page's confirm() (End party?) as a real iPhone dialog
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .destructive) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
}
