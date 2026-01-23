import { X, Check, Shield, Crown } from 'lucide-react';
import '../index.css';

interface PaywallProps {
    onClose: () => void;
    onUpgrade: () => void;
}

export const Paywall: React.FC<PaywallProps> = ({ onClose, onUpgrade }) => {

    const handleBuyNow = () => {
        // Open the external payment page
        window.open('https://tryjulie.vercel.app/pricing', '_blank');
    };

    return (
        <div className="paywall-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="paywall-card" style={{
                background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
                width: '400px', borderRadius: '24px', padding: '32px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 80px rgba(0,0,0,0.5)',
                color: 'white', position: 'relative'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: '16px', right: '16px',
                    background: 'transparent', border: 'none', color: '#666', cursor: 'pointer'
                }}>
                    <X size={20} />
                </button>

                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px', boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'
                    }}>
                        <Crown size={32} color="black" />
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Upgrade to Premium</h2>
                    <p style={{ color: '#888', fontSize: '14px' }}>Unlock the full power of Julie with x.ai</p>
                </div>

                <div className="features-list" style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ minWidth: '24px', color: '#10b981' }}><Check size={18} /></div>
                        <div style={{ marginLeft: '12px', fontSize: '15px' }}>
                            <strong style={{ display: 'block' }}>Grok Integration</strong>
                            <span style={{ color: '#888', fontSize: '13px' }}>Access to Grok-beta with no API key required.</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ minWidth: '24px', color: '#10b981' }}><Check size={18} /></div>
                        <div style={{ marginLeft: '12px', fontSize: '15px' }}>
                            <strong style={{ display: 'block' }}>Enhanced Agents</strong>
                            <span style={{ color: '#888', fontSize: '13px' }}>Smarter, faster 128k context agent actions.</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ minWidth: '24px', color: '#10b981' }}><Check size={18} /></div>
                        <div style={{ marginLeft: '12px', fontSize: '15px' }}>
                            <strong style={{ display: 'block' }}>Privacy First</strong>
                            <span style={{ color: '#888', fontSize: '13px' }}>Your data stays local or secure via x.ai enterprise.</span>
                        </div>
                    </div>
                </div>

                <button onClick={handleBuyNow} style={{
                    width: '100%', padding: '16px', borderRadius: '12px',
                    background: 'linear-gradient(90deg, #FFD700 0%, #FFA500 100%)',
                    border: 'none', color: 'black', fontWeight: 'bold', fontSize: '16px',
                    cursor: 'pointer', transition: 'transform 0.1s', marginBottom: '12px'
                }}>
                    Unlock Premium - $9.99
                </button>

                <button onClick={onUpgrade} style={{
                    width: '100%', padding: '12px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none', color: 'white', fontSize: '14px',
                    cursor: 'pointer'
                }}>
                    I have already paid (Refresh Status)
                </button>

                <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#444' }}>
                    <Shield size={10} style={{ display: 'inline', marginRight: '4px' }} />
                    Secure Payment Processed by Stripe
                </p>
            </div>
        </div>
    );
};
