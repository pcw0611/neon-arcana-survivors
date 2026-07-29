using TMPro;
using UnityEngine;

namespace NeonArcana
{
    /// <summary>
    /// 웹 원본은 텍스트에도 <c>ctx.shadowBlur</c>를 걸어 글자가 발광한다.
    /// UI Outline 컴포넌트는 TMP 메시에 적용되지 않으므로 TMP 셰이더 기능을 직접 쓴다.
    ///
    /// 주의할 점이 두 가지 있다.
    /// 1. TMP가 만드는 폰트 머티리얼은 <c>TextMeshPro/Mobile/Distance Field</c> 셰이더라
    ///    GLOW_ON 키워드가 아예 없다. 대신 UNDERLAY_ON(오프셋 0짜리 소프트 섀도)을 쓰면
    ///    웹의 shadowBlur와 사실상 같은 번짐이 나온다.
    /// 2. 머티리얼 인스턴스는 프리팹에 직렬화되지 않는다. 그래서 설정값만 들고 있다가
    ///    런타임 <c>Start</c>에서 적용한다. (<c>Awake</c>는 TMP 초기화 전이라 이르다.)
    /// </summary>
    [RequireComponent(typeof(TMP_Text))]
    public sealed class NeonTextGlow : MonoBehaviour
    {
        [SerializeField] private Color glowColor = new(0.35f, 0.7f, 1f);
        [SerializeField] private float glowSpread = 0.35f;
        [SerializeField] private float glowStrength = 0.55f;
        [SerializeField] private float outlineWidth;
        [SerializeField] private Color outlineColor = Color.clear;

        public void Configure(Color glow, float spread, float strength, float outline = 0f, Color? outlineTint = null)
        {
            glowColor = glow;
            glowSpread = spread;
            glowStrength = strength;
            outlineWidth = outline;
            outlineColor = outlineTint ?? Color.clear;
        }

        private void Start() => Apply();

        private void Apply()
        {
            var text = GetComponent<TMP_Text>();
            if (text == null) return;
            text.ForceMeshUpdate();

            var shared = text.fontSharedMaterial;
            if (shared == null) return;

            // 공유 머티리얼을 그대로 건드리면 같은 폰트를 쓰는 모든 텍스트가 같이 빛난다.
            var material = new Material(shared) { name = shared.name + " (Neon)" };

            material.EnableKeyword(ShaderUtilities.Keyword_Underlay);
            material.SetColor(ShaderUtilities.ID_UnderlayColor, new Color(glowColor.r, glowColor.g, glowColor.b, Mathf.Clamp01(glowStrength)));
            material.SetFloat(ShaderUtilities.ID_UnderlayOffsetX, 0f);
            material.SetFloat(ShaderUtilities.ID_UnderlayOffsetY, 0f);
            material.SetFloat(ShaderUtilities.ID_UnderlayDilate, Mathf.Clamp(glowSpread, -1f, 1f));
            material.SetFloat(ShaderUtilities.ID_UnderlaySoftness, 1f);

            if (outlineWidth > 0f)
            {
                material.EnableKeyword(ShaderUtilities.Keyword_Outline);
                material.SetColor(ShaderUtilities.ID_OutlineColor, outlineColor);
                material.SetFloat(ShaderUtilities.ID_OutlineWidth, Mathf.Clamp01(outlineWidth));
            }

            text.fontMaterial = material;
        }
    }
}
