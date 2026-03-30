import React, { useState } from 'react';

/**
 * A simple mock checkout page for testing the annotation workflow.
 * Every element here is a realistic annotation target.
 */
export function MockCheckout() {
  const [email, setEmail] = useState('');

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      {/* Left: Checkout form */}
      <div style={{ flex: 1 }}>
        <div style={cardStyle}>
          <h2 id="checkout-header" style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
            Checkout
          </h2>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>

          {/* Card info */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Card information</label>
            <input
              type="text"
              placeholder="1234 1234 1234 1234"
              style={{ ...inputStyle, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            />
            <div style={{ display: 'flex' }}>
              <input
                type="text"
                placeholder="MM / YY"
                style={{ ...inputStyle, borderRadius: 0, borderRight: 'none', flex: 1 }}
              />
              <input
                type="text"
                placeholder="CVC"
                style={{ ...inputStyle, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 0, flex: 1 }}
              />
            </div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name on card</label>
            <input
              type="text"
              placeholder="Full name"
              style={inputStyle}
            />
          </div>

          {/* Country */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Country or region</label>
            <select style={{ ...inputStyle, appearance: 'none' }}>
              <option>United States</option>
              <option>Canada</option>
              <option>United Kingdom</option>
            </select>
          </div>

          {/* Save button */}
          <button className="btn-primary" style={primaryButtonStyle}>
            Pay $49.00
          </button>

          <p style={{ fontSize: 12, color: '#86868b', marginTop: 12, textAlign: 'center' }}>
            Your payment is secure and encrypted.
          </p>
        </div>
      </div>

      {/* Right: Order summary */}
      <div style={{ width: 300 }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Order summary
          </h3>

          <div style={lineItemStyle}>
            <span>Contextual Pro (Monthly)</span>
            <span>$49.00</span>
          </div>
          <div style={lineItemStyle}>
            <span>Tax</span>
            <span>$0.00</span>
          </div>
          <div style={{ ...lineItemStyle, fontWeight: 600, borderTop: '1px solid #e5e5ea', paddingTop: 12 }}>
            <span>Total</span>
            <span>$49.00</span>
          </div>
        </div>

        {/* Trust badges */}
        <div style={{ marginTop: 16, padding: '0 8px' }}>
          <div style={badgeStyle}>
            <span style={{ fontSize: 16, marginRight: 8 }}>&#128274;</span>
            SSL Encrypted
          </div>
          <div style={badgeStyle}>
            <span style={{ fontSize: 16, marginRight: 8 }}>&#8635;</span>
            30-day money back
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles
const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  border: '1px solid #e5e5ea',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#1d1d1f',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #d2d2d7',
  borderRadius: 8,
  outline: 'none',
  backgroundColor: '#fff',
  color: '#1d1d1f',
  boxSizing: 'border-box',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 20px',
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
  backgroundColor: '#6366f1',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
};

const lineItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 14,
  color: '#1d1d1f',
  marginBottom: 8,
};

const badgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 13,
  color: '#6e6e73',
  marginBottom: 8,
};
