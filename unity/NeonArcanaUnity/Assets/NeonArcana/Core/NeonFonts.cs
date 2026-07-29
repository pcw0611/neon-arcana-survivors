using TMPro;
using UnityEngine;

namespace NeonArcana
{
    /// <summary>
    /// 프로젝트 전역 TextMeshPro 폰트 공급자.
    ///
    /// TMP 기본 폰트(LiberationSans)에는 한글 글리프가 없어 한국어 텍스트가 전부 깨진다.
    /// 맑은 고딕을 소스로 동적 폰트 에셋을 만들어, 필요한 글리프를 런타임에 아틀라스로 굽는다.
    /// 동적 모드라 사전에 모든 한글을 구워둘 필요가 없다.
    /// </summary>
    public static class NeonFonts
    {
        private static TMP_FontAsset cached;
        private static bool resolved;

        public static TMP_FontAsset Primary()
        {
            if (resolved) return cached;
            resolved = true;

            // 에디터에서 미리 구워둔 폰트 에셋을 우선 쓴다.
            // 런타임 생성 폰트는 디스크에 없어 프리팹 직렬화에서 사라지므로, 이 경로가 정상 경로다.
            cached = Resources.Load<TMP_FontAsset>("Fonts/NeonArcanaKoreanSDF");
            if (cached != null) return cached;

            var source = Resources.Load<Font>("Fonts/NeonArcanaKorean");
            if (source == null)
            {
                // 에디터/빌드 경로 차이에 대비한 대체 경로.
                source = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            }

            if (source != null)
            {
                cached = TMP_FontAsset.CreateFontAsset(
                    source,
                    90,
                    9,
                    UnityEngine.TextCore.LowLevel.GlyphRenderMode.SDFAA,
                    1024,
                    1024,
                    AtlasPopulationMode.Dynamic);
                if (cached != null) cached.name = "NeonArcana Korean SDF";
            }

            if (cached == null) cached = TMP_Settings.defaultFontAsset;
            return cached;
        }
    }
}
