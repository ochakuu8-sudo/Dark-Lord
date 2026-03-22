import React, { useEffect, useState, useRef } from 'react';

interface ResponsiveWrapperProps {
  children: React.ReactNode;
  logicalWidth?: number;
  logicalHeight?: number;
}

const ResponsiveWrapper: React.FC<ResponsiveWrapperProps> = ({ 
  children, 
  logicalWidth = 1670, 
  logicalHeight = 800 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      // スマホブラウザのタブ・URLバー高さを考慮するため、innerHeightを使用
      const windowHeight = window.innerHeight;

      const scaleX = windowWidth / logicalWidth;
      const scaleY = windowHeight / logicalHeight;
      const newScale = Math.min(scaleX, scaleY);
      
      setScale(newScale);
      
      // コンテナ自体の高さも動的に更新する (100vhだとスマホバーの下に潜るため)
      if (containerRef.current && containerRef.current.parentElement) {
          containerRef.current.parentElement.style.height = `${windowHeight}px`;
      }
    };

    // Initial calculation
    handleResize();

    window.addEventListener('resize', handleResize);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // フルスクリーン切り替え直後はリサイズイベントが発火しないことがあるため、手動でも計算
      setTimeout(handleResize, 100);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [logicalWidth, logicalHeight]);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;

    // もし疑似フルスクリーン状態なら解除
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      setIsFullscreen(false);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      return;
    }

    try {
      if (!document.fullscreenElement) {
        // フルスクリーン化を試行
        let success = false;
        if (wrapperRef.current.requestFullscreen) {
          await wrapperRef.current.requestFullscreen();
          success = true;
        } else if ((wrapperRef.current as any).webkitRequestFullscreen) {
          await (wrapperRef.current as any).webkitRequestFullscreen();
          success = true;
        } else if ((wrapperRef.current as any).msRequestFullscreen) {
          await (wrapperRef.current as any).msRequestFullscreen();
          success = true;
        }

        // Web APIが対応していない、またはエラーで失敗した場合は疑似フルスクリーンへ
        if (!success) throw new Error("Fullscreen API not supported");
        
      } else {
        // 通常のフルスクリーン解除
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("フルスクリーンAPIが失敗しました。疑似フルスクリーン(CSS)に切り替えます:", err);
      // フォールバック: CSSによる疑似フルスクリーン
      setIsPseudoFullscreen(true);
      setIsFullscreen(true);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
    }
  };

  const wrapperStyle: React.CSSProperties = isPseudoFullscreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100dvh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    overflow: 'hidden',
    zIndex: 99999
  } : {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative'
  };

  return (
    <div 
      ref={wrapperRef}
      style={wrapperStyle}
    >
      <div 
        ref={containerRef}
        style={{
          width: `${logicalWidth}px`,
          height: `${logicalHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {children}
      </div>

      <button
        onClick={toggleFullscreen}
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          zIndex: 9999,
          background: 'rgba(50, 50, 50, 0.5)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '5px',
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: '18px',
          backdropFilter: 'blur(2px)'
        }}
        title="全画面表示の切り替え"
      >
        {isFullscreen ? '🖥️ 解除' : '📱 全画面'}
      </button>
    </div>
  );
};

export default ResponsiveWrapper;
