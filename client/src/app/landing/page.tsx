"use client";

import React from 'react';
import Link from 'next/link';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      {/* ヘッダー */}
      <header className="header">
        <div className="container">
          <div className="logo">
            <h1>ZAIMYAKU</h1>
            <p>政府予算の透明性向上を支援</p>
          </div>
          <nav className="nav">
            <Link href="/" className="cta-button">
              システムを開始
            </Link>
          </nav>
        </div>
      </header>

      {/* メインビジュアル */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span>💡</span>
              税金の使い道を見える化
            </div>
            <h1>あなたの税金、どこに使われてる？</h1>
            <p className="hero-subtitle">
              あなたの関心のある分野の予算を、<br />
              簡単操作で素早く見つけられます
            </p>
            
            {/* 簡易検索フォーム */}
            <div className="quick-search">
              <div className="search-steps">
                <div className="step-item active">
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <label>関心のある分野</label>
                    <select className="search-select">
                      <option>選択してください</option>
                      <option>教育・子育て</option>
                      <option>医療・福祉</option>
                      <option>防災・安全</option>
                      <option>環境・エネルギー</option>
                      <option>産業・雇用</option>
                    </select>
                  </div>
                </div>
                <div className="step-arrow">→</div>
                <div className="step-item">
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <label>詳細キーワード</label>
                    <input type="text" className="search-input" placeholder="例：学校給食、病院" />
                  </div>
                </div>
                <div className="step-arrow">→</div>
                <div className="step-item">
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <Link href="/" className="search-button">
                      <span>🔍</span>
                      予算を検索
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="hero-features">
              <div className="feature-tag">✓ 無料</div>
              <div className="feature-tag">✓ 登録不要</div>
              <div className="feature-tag">✓ 2024年度最新データ</div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Issue */}
      <section className="social-issue">
        <div className="container">
          <h2>社会課題</h2>
          <div className="issue-content">
            <div className="issue-item">
              <div className="issue-icon">📊</div>
              <h3>複雑で理解困難な政府予算</h3>
              <p>膨大な予算資料は専門的で、一般市民には理解が困難</p>
            </div>
            <div className="issue-item">
              <div className="issue-icon">🔍</div>
              <h3>限られた透明性</h3>
              <p>税金の具体的な使い道が見えにくく、行政への関心が低下</p>
            </div>
            <div className="issue-item">
              <div className="issue-icon">📋</div>
              <h3>データ活用の壁</h3>
              <p>オープンデータは公開されているが、活用するハードルが高い</p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="vision">
        <div className="container">
          <h2>ビジョン</h2>
          <div className="vision-content">
            <h3>専門家からすべての国民へ</h3>
            <p className="vision-main">データに対する意識の転換をもたらし、<br />誰でも気軽にオープンデータを使える世界へ</p>
            <div className="stages">
              <div className="stage-flow">
                <div className="stage current-stage">
                  <div className="stage-number">現在</div>
                  <div className="stage-content">
                    <h4>Stage 1：知る</h4>
                    <p>専門家のみがデータを理解・活用</p>
                    <div className="arrow">↓</div>
                    <h4>Stage 2：利活用へ</h4>
                    <p>一般市民にはハードルが高い</p>
                  </div>
                </div>
                <div className="transformation">→</div>
                <div className="stage target-stage">
                  <div className="stage-number">目標</div>
                  <div className="stage-content">
                    <h4>Stage 1：知る</h4>
                    <p>データの存在を認識</p>
                    <div className="arrow">↓</div>
                    <h4>Stage 2：見る・触れる</h4>
                    <p className="highlight">視覚的・直感的な体験</p>
                    <div className="arrow">↓</div>
                    <h4>Stage 3：利活用へ</h4>
                    <p>自然な利活用への移行</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Market試算 */}
      <section className="market">
        <div className="container">
          <h2>市場規模とインパクト</h2>
          <div className="market-grid">
            <div className="market-card">
              <div className="market-number">1.27億人</div>
              <div className="market-label">対象人口</div>
              <div className="market-desc">日本の全人口（潜在ユーザー）</div>
            </div>
            <div className="market-card">
            <div className="market-number">114兆円</div>
              <div className="market-label">2024年度予算</div>
              <div className="market-desc">国家予算総額</div>
            </div>
            <div className="market-card">
              <div className="market-number">2,000+</div>
              <div className="market-label">対象事業数</div>
              <div className="market-desc">見える化対象の政府事業</div>
            </div>
            <div className="market-card">
              <div className="market-number">23省庁</div>
              <div className="market-label">カバー範囲</div>
              <div className="market-desc">全府省庁のデータを網羅</div>
            </div>
          </div>
        </div>
      </section>


      {/* Competence */}
      <section className="competence">
        <div className="container">
          <h2>私たちの強み</h2>
          <div className="competence-grid">
            <div className="competence-card">
              <div className="competence-icon">🎨</div>
              <h3>視覚化技術</h3>
              <p>複雑なデータを直感的に理解できるネットワーク図として表現</p>
            </div>
            <div className="competence-card">
              <div className="competence-icon">🔄</div>
              <h3>リアルタイム更新</h3>
              <p>政府公開データと連携し、常に最新の予算情報を提供</p>
            </div>
            <div className="competence-card">
              <div className="competence-icon">📱</div>
              <h3>ユーザビリティ</h3>
              <p>PC・スマートフォン対応で、いつでもどこでもアクセス可能</p>
            </div>
            <div className="competence-card">
              <div className="competence-icon">🔍</div>
              <h3>高度な検索機能</h3>
              <p>キーワード検索で関心のある分野の予算を瞬時に発見</p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision Conclusion / Call for Action */}
      <section className="call-for-action">
        <div className="container">
          <h2>税金の使い道を<br />確認してみませんか</h2>
          <p>国民の皆様からお納めいただいた税金が、どのような事業に活用されているかを、<br />このシステムで簡単にご確認いただけます。</p>
          <div className="cta-buttons">
            <Link href="/" className="large-cta-button primary">
              <span>🚀</span>
              今すぐ始める
            </Link>
            <Link href="#how-to-use" className="large-cta-button secondary">
              <span>📖</span>
              使い方を見る
            </Link>
          </div>
          <div className="cta-features">
            <div className="cta-feature">
              <svg className="check-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <p>無料でご利用いただけます</p>
            </div>
            <div className="cta-feature">
              <svg className="check-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <p>会員登録は不要です</p>
            </div>
            <div className="cta-feature">
              <svg className="check-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <p>最新のデータを常時更新</p>
            </div>
          </div>
        </div>
      </section>


      <style jsx>{`
        .landing-page {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* ヘッダー */
        .header {
          background: #fff;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header .container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
        }

        .logo h1 {
          margin: 0;
          color: #07796b;
          font-size: 24px;
          font-weight: 700;
        }

        .logo p {
          margin: 4px 0 0 0;
          color: #666;
          font-size: 14px;
        }

        .cta-button {
          background: #07796b;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: background 0.3s;
        }

        .cta-button:hover {
          background: #;
        }

        /* ヒーローセクション */
        .hero {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 80px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .hero-content {
          text-align: center;
          max-width: 900px;
          margin: 0 auto;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #07796b;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .hero-content h1 {
          font-size: 42px;
          margin: 0 0 16px 0;
          color: #1a1a1a;
          font-weight: 700;
          line-height: 1.2;
        }

        .hero-subtitle {
          font-size: 20px;
          color: #666;
          margin: 0 0 40px 0;
          line-height: 1.5;
        }

        .quick-search {
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }

        .search-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 200px;
        }

        .step-number {
          width: 32px;
          height: 32px;
          background: #e2e8f0;
          color: #666;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .step-item.active .step-number {
          background: #07796b;
          color: white;
        }

        .step-content {
          width: 100%;
        }

        .step-content label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #374151;
        }

        .search-select, .search-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.3s;
        }

        .search-select:focus, .search-input:focus {
          outline: none;
          border-color: #07796b;
        }

        .search-button {
          background: #07796b;
          color: white;
          padding: 14px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
          min-width: 140px;
          justify-content: center;
        }

        .search-button:hover {
          background: #07796b;
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
        }

        .step-arrow {
          font-size: 20px;
          color: #9ca3af;
          font-weight: 600;
        }

        .hero-features {
          display: flex;
          justify-content: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .feature-tag {
          background: rgba(249,115,22,0.1);
          color: #07796b;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .primary-button {
          background: #1976d2;
          color: white;
          padding: 16px 32px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
          box-shadow: 0 4px 20px rgba(25,118,210,0.3);
        }

        .primary-button:hover {
          background: #1565c0;
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(25,118,210,0.4);
        }

        .secondary-button {
          background: transparent;
          color: #1976d2;
          padding: 16px 32px;
          border: 2px solid #1976d2;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 600;
          font-size: 18px;
          transition: all 0.3s;
        }

        .secondary-button:hover {
          background: #1976d2;
          color: white;
        }

        /* ネットワークプレビュー */
        .hero-visual {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .network-preview {
          position: relative;
          width: 400px;
          height: 300px;
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          overflow: hidden;
        }

        .node {
          position: absolute;
          background: #1976d2;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 12px;
          animation: float 3s ease-in-out infinite;
        }

        .node.large {
          width: 80px;
          height: 80px;
          top: 50px;
          left: 50px;
          animation-delay: 0s;
        }

        .node.medium {
          width: 60px;
          height: 60px;
          font-size: 10px;
        }

        .node.medium:nth-of-type(2) {
          top: 80px;
          right: 80px;
          animation-delay: 1s;
        }

        .node.medium:nth-of-type(3) {
          bottom: 60px;
          left: 80px;
          animation-delay: 2s;
        }

        .node.small {
          width: 40px;
          height: 40px;
          font-size: 8px;
          background: #42a5f5;
        }

        .node.small:nth-of-type(4) {
          top: 160px;
          right: 40px;
          animation-delay: 0.5s;
        }

        .node.small:nth-of-type(5) {
          bottom: 40px;
          right: 120px;
          animation-delay: 1.5s;
        }

        .connection, .connection-2, .connection-3 {
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, #1976d2, transparent);
          animation: pulse 2s ease-in-out infinite;
        }

        .connection {
          width: 100px;
          top: 90px;
          left: 130px;
          transform: rotate(45deg);
        }

        .connection-2 {
          width: 80px;
          bottom: 100px;
          left: 120px;
          transform: rotate(-30deg);
          animation-delay: 0.7s;
        }

        .connection-3 {
          width: 60px;
          top: 200px;
          right: 80px;
          transform: rotate(20deg);
          animation-delay: 1.4s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        /* Social Issue */
        .social-issue {
          padding: 100px 0;
          background: #f8f9fa;
        }

        .social-issue h2 {
          text-align: center;
          font-size: 36px;
          margin: 0 0 60px 0;
          color: #1a1a1a;
        }

        .issue-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 40px;
        }

        .issue-item {
          background: white;
          padding: 40px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }

        .issue-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .issue-item h3 {
          font-size: 20px;
          margin: 0 0 16px 0;
          color: #07796b;
        }

        .issue-item p {
          color: #666;
          line-height: 1.6;
        }

        /* Vision */
        .vision {
          padding: 100px 0;
          background: linear-gradient(135deg, #07796b 0%, #0a9a89 100%);
          color: white;
        }

        .vision h2 {
          text-align: center;
          font-size: 36px;
          margin: 0 0 40px 0;
        }

        .vision-content {
          text-align: center;
        }

        .vision-content h3 {
          font-size: 28px;
          margin: 0 0 20px 0;
        }

        .vision-main {
          font-size: 24px;
          margin: 0 0 60px 0;
          line-height: 1.4;
        }

        .stages {
          display: flex;
          justify-content: center;
        }

        .stage-flow {
          display: flex;
          align-items: center;
          gap: 40px;
        }

        .stage {
          background: rgba(255,255,255,0.1);
          padding: 30px;
          border-radius: 16px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          min-width: 300px;
        }

        .stage-number {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 20px;
          text-align: center;
        }

        .stage-content h4 {
          font-size: 18px;
          margin: 0 0 8px 0;
        }

        .stage-content p {
          font-size: 14px;
          margin: 0;
          opacity: 0.9;
        }

        .arrow {
          text-align: center;
          font-size: 20px;
          margin: 10px 0;
        }

        .highlight {
          background: rgba(255,255,255,0.2);
          padding: 8px;
          border-radius: 8px;
          font-weight: 600;
        }

        .transformation {
          font-size: 32px;
          font-weight: 600;
        }

        /* Market */
        .market {
          padding: 100px 0;
          background: #fff;
        }

        .market h2 {
          text-align: center;
          font-size: 36px;
          margin: 0 0 60px 0;
          color: #1a1a1a;
        }

        .market-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 40px;
        }

        .market-card {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 16px;
          border: 1px solid #e0e0e0;
        }

        .market-number {
          font-size: 48px;
          font-weight: 700;
          color: #07796b;
          margin-bottom: 8px;
        }

        .market-label {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .market-desc {
          color: #666;
          font-size: 14px;
        }


        /* Competence */
        .competence {
          padding: 100px 0;
          background: #fff;
        }

        .competence h2 {
          text-align: center;
          font-size: 36px;
          margin: 0 0 60px 0;
          color: #1a1a1a;
        }

        .competence-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 40px;
        }

        .competence-card {
          padding: 40px;
          border-radius: 16px;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          text-align: center;
          transition: all 0.3s;
        }

        .competence-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          border-color: #07796b;
        }

        .competence-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .competence-card h3 {
          font-size: 20px;
          margin: 0 0 16px 0;
          color: #1a1a1a;
        }

        .competence-card p {
          color: #666;
          line-height: 1.6;
        }

        /* Call for Action */
        .call-for-action {
          padding: 100px 0;
          background: linear-gradient(135deg, #07796b 0%, #0a9a89 100%);
          color: white;
          text-align: center;
        }

        .call-for-action h2 {
          font-size: 36px;
          margin: 0 0 20px 0;
        }

        .call-for-action p {
          font-size: 18px;
          margin: 0 0 40px 0;
          opacity: 0.9;
        }

        .cta-buttons {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-bottom: 40px;
        }

        .large-cta-button {
          padding: 20px 40px;
          border-radius: 50px;
          text-decoration: none;
          font-weight: 700;
          font-size: 20px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s;
          box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        }

        .large-cta-button.primary {
          background: white;
          color: #07796b;
        }

        .large-cta-button.secondary {
          background: transparent;
          color: white;
          border: 2px solid white;
        }

        .large-cta-button:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }

        .cta-features {
          display: flex;
          justify-content: center;
          gap: 40px;
          flex-wrap: wrap;
        }

        .cta-feature {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge-icon {
          width: 16px;
          height: 16px;
        }

        .search-icon {
          width: 20px;
          height: 20px;
        }

        .button-icon {
          width: 18px;
          height: 18px;
        }

        .issue-icon {
          width: 48px;
          height: 48px;
          margin-bottom: 20px;
          color: #07796b;
        }

        .competence-icon {
          width: 48px;
          height: 48px;
          margin-bottom: 20px;
          color: #07796b;
        }

        .cta-icon {
          width: 20px;
          height: 20px;
        }

        .check-icon {
          width: 18px;
          height: 18px;
          color: #10b981;
        }

        .cta-feature p {
          margin: 0;
          font-size: 14px;
          opacity: 0.9;
        }


        /* レスポンシブ対応 */
        @media (max-width: 768px) {
          .hero-content h1 {
            font-size: 32px;
            line-height: 1.3;
          }

          .hero-subtitle {
            font-size: 18px;
          }

          .search-steps {
            flex-direction: column;
            gap: 24px;
          }

          .step-arrow {
            transform: rotate(90deg);
          }

          .quick-search {
            padding: 24px;
          }

          .step-item {
            min-width: auto;
            width: 100%;
            max-width: 280px;
          }

          .issue-content {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .competence-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .market-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }

          .stage-flow {
            flex-direction: column;
            gap: 30px;
          }

          .transformation {
            transform: rotate(90deg);
          }

          .stage {
            min-width: auto;
            width: 100%;
            max-width: 350px;
          }

          .cta-buttons {
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }

          .large-cta-button {
            width: 100%;
            max-width: 280px;
          }

          .social-issue, .vision, .market, .competence, .call-for-action {
            padding: 60px 0;
          }

          .stage-flow {
            flex-direction: column;
          }

          .transformation {
            transform: rotate(90deg);
          }


          .cta-buttons {
            flex-direction: column;
            align-items: center;
          }

          .cta-features {
            flex-direction: column;
            align-items: center;
            gap: 20px;
          }


          .network-preview {
            width: 300px;
            height: 200px;
          }

          .hero-actions {
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .hero {
            padding: 40px 0;
          }

          .hero-content h1 {
            font-size: 28px;
          }

          .hero-subtitle {
            font-size: 16px;
          }

          .hero-features {
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }

          .market-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .cta-features {
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }

          .quick-search {
            padding: 20px;
          }

          .search-button {
            min-width: 140px;
            padding: 14px 24px;
          }

          .large-cta-button {
            font-size: 16px;
            padding: 16px 32px;
          }

          .hero-content h1, .vision h2, .market h2, .competence h2, .call-for-action h2 {
            margin-bottom: 20px;
          }

          .vision-main {
            font-size: 20px;
          }

          .stage {
            padding: 20px;
          }
        }

        /* 追加のアニメーション */
        @keyframes countUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }

        @keyframes heartbeat {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes wiggle {
          0%, 7% {
            transform: rotateZ(0);
          }
          15% {
            transform: rotateZ(-15deg);
          }
          20% {
            transform: rotateZ(10deg);
          }
          25% {
            transform: rotateZ(-10deg);
          }
          30% {
            transform: rotateZ(6deg);
          }
          35% {
            transform: rotateZ(-4deg);
          }
          40%, 100% {
            transform: rotateZ(0);
          }
        }

        .animate-count-up {
          animation: countUp 0.8s ease-out forwards;
        }

        .animate-count-up-delay1 {
          animation: countUp 0.8s ease-out 0.2s both;
        }

        .animate-count-up-delay2 {
          animation: countUp 0.8s ease-out 0.4s both;
        }

        .animate-count-up-delay3 {
          animation: countUp 0.8s ease-out 0.6s both;
        }

        .pulse-button {
          animation: heartbeat 2s infinite;
        }

        .pulse-button:hover {
          animation: none;
        }

        .competence-card:hover .competence-icon {
          animation: wiggle 0.8s ease-in-out;
          color: #065952;
        }

        .issue-item:hover .issue-icon {
          animation: bounce 1s ease;
          color: #07796b;
        }

        .market-card:hover .market-number {
          color: #065952;
          text-shadow: 0 0 20px rgba(7, 121, 107, 0.5);
        }
      `}</style>
    </div>
  );
};

export default LandingPage;