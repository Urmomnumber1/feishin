import AVFoundation
import UIKit
import WebKit

// Sour Player TV for iPhone. Two screens:
// - the phone: Hermes Music's /tv/ page (sign in, start the party, add songs, the buttons; it plays the music)
// - the TV, when Screen Mirroring is on: iOS gives the app the TV as a screen of its own, and it shows the
//   party there (/tv/?screen=CODE, no buttons) instead of a copy of the phone
// The page tells the app which party is on through the "sourtv" message.

extension Notification.Name {
    static let sourPartyChanged = Notification.Name("sourPartyChanged")
}

enum Shared {
    static let addressKey = "hermesAddress"
    // one web process and storage for both screens, so the TV picture is signed in like the phone
    static let processPool = WKProcessPool()

    static var hermes: URL? {
        get { UserDefaults.standard.string(forKey: addressKey).flatMap(URL.init(string:)) }
        set { UserDefaults.standard.set(newValue?.absoluteString, forKey: addressKey) }
    }

    // the party the phone is running (nil: none yet)
    static var partyCode: String? {
        didSet { NotificationCenter.default.post(name: .sourPartyChanged, object: nil) }
    }

    static func webConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        config.processPool = processPool
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        return config
    }

    // "100.69.236.80:3340" or "umbrel.local:3340" -> http://.../
    static func normalize(_ text: String) -> URL? {
        var t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return nil }
        if !t.contains("://") { t = "http://" + t }
        while t.hasSuffix("/") { t.removeLast() }
        return URL(string: t)
    }
}

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // music keeps playing with the screen locked or the app in the background
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let role = connectingSceneSession.role
        if role == .windowApplication {
            let config = UISceneConfiguration(name: "Phone", sessionRole: role)
            config.delegateClass = SceneDelegate.self
            return config
        }
        // the TV (Screen Mirroring / AirPlay / a cable)
        let config = UISceneConfiguration(name: "TV", sessionRole: role)
        config.delegateClass = TVSceneDelegate.self
        return config
    }
}
