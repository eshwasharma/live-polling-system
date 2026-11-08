
import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import {
  X,
  Copy,
  Check,
  Download,
  Link,
  QrCode,
  Palette,
} from "lucide-react";

const QR_STYLES = [
  {
    id: "purple",
    name: "Pulse Purple",
    dots: "#6854df",
    background: "#ffffff",
    corners: "#4935c4",
  },
  {
    id: "lavender",
    name: "Lavender",
    dots: "#a78bfa",
    background: "#ffffff",
    corners: "#7c3aed",
  },
  {
    id: "dark",
    name: "Midnight",
    dots: "#a78bfa",
    background: "#17142b",
    corners: "#c4b5fd",
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    dots: "#2563eb",
    background: "#ffffff",
    corners: "#1d4ed8",
  },
];

function SharePollModal({ poll, onClose }) {
  const qrRef = useRef(null);
  const qrInstance = useRef(null);

  const [selectedStyle, setSelectedStyle] = useState("purple");
  const [copied, setCopied] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const votingLink = `${window.location.origin}/poll/${poll.id}`;

  const currentStyle =
    QR_STYLES.find((style) => style.id === selectedStyle) ||
    QR_STYLES[0];

  // Generate the QR code and update it when the selected design changes.
  useEffect(() => {
    if (!qrRef.current) return;

    const qr = new QRCodeStyling({
      width: 260,
      height: 260,
      type: "svg",
      data: votingLink,
      margin: 12,
      qrOptions: {
        errorCorrectionLevel: "H",
      },
      dotsOptions: {
        color: currentStyle.dots,
        type: "rounded",
      },
      cornersSquareOptions: {
        color: currentStyle.corners,
        type: "extra-rounded",
      },
      cornersDotOptions: {
        color: currentStyle.corners,
        type: "dot",
      },
      backgroundOptions: {
        color: currentStyle.background,
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.3,
        margin: 5,
        crossOrigin: "anonymous",
      },
    });

    qrRef.current.innerHTML = "";
    qr.append(qrRef.current);

    qrInstance.current = qr;
  }, [votingLink, currentStyle]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(votingLink);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Could not copy voting link:", error);
      setDownloadError("Unable to copy the link. Please copy it manually.");
    }
  }

  async function handleDownload() {
    if (!qrInstance.current) return;

    try {
      setDownloadError("");

      await qrInstance.current.download({
        name: `pulsepoll-${poll.id}-${selectedStyle}`,
        extension: "png",
      });
    } catch (error) {
      console.error("QR download failed:", error);
      setDownloadError("Unable to download the QR code. Please try again.");
    }
  }

  return (
    <div
      className="share-modal-overlay"
      onClick={onClose}
    >
      <div
        className="share-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-modal-header">
          <div>
            <div className="share-modal-eyebrow">
              <QrCode size={15} />
              SHARE YOUR POLL
            </div>

            <h2>Invite your audience</h2>

            <p>Let people scan and participate in your poll.</p>
          </div>

          <button
            type="button"
            className="share-modal-close"
            onClick={onClose}
            aria-label="Close sharing window"
          >
            <X size={20} />
          </button>
        </div>

        <div className="share-modal-body">
          <div className="share-qr-section">
            <div
              className="share-qr-preview"
              style={{
                background: currentStyle.background,
              }}
            >
              <div ref={qrRef} className="share-qr-code" />
            </div>

            <div className="share-qr-brand">
              <span className="share-qr-brand-icon">
                <QrCode size={16} />
              </span>
              <strong>PulsePoll</strong>
            </div>

            <p className="share-qr-caption">
              Scan this code to vote
            </p>

            <button
              type="button"
              className="share-download-button"
              onClick={handleDownload}
            >
              <Download size={17} />
              Download QR Code
            </button>
          </div>

          <div className="share-customization">
            <div className="share-section-heading">
              <Palette size={17} />
              <h3>Choose your QR style</h3>
            </div>

            <div className="share-style-grid">
              {QR_STYLES.map((style) => (
                <button
                  type="button"
                  key={style.id}
                  className={`share-style-option ${
                    selectedStyle === style.id
                      ? "share-style-selected"
                      : ""
                  }`}
                  onClick={() => setSelectedStyle(style.id)}
                >
                  <span
                    className="share-style-swatch"
                    style={{
                      background: style.background,
                      border: `2px solid ${style.dots}`,
                    }}
                  >
                    <span
                      style={{
                        background: style.dots,
                      }}
                    />
                  </span>

                  <span>{style.name}</span>

                  {selectedStyle === style.id && (
                    <Check size={14} />
                  )}
                </button>
              ))}
            </div>

            <div className="share-link-section">
              <div className="share-section-heading">
                <Link size={17} />
                <h3>Public voting link</h3>
              </div>

              <div className="share-link-input">
                <span title={votingLink}>{votingLink}</span>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-label="Copy voting link"
                >
                  {copied ? <Check size={17} /> : <Copy size={17} />}
                </button>
              </div>

              {copied && (
                <p className="share-success-message">
                  Link copied successfully!
                </p>
              )}
            </div>

            {downloadError && (
              <p className="share-error-message" role="alert">
                {downloadError}
              </p>
            )}
          </div>
        </div>

        <div className="share-modal-footer">
          <span>Powered by PulsePoll</span>

          <button
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default SharePollModal;
