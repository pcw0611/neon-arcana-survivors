using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace NeonArcana
{
    /// <summary>
    /// 코드로 만든 그라디언트 스프라이트를 런타임에 Image에 붙인다.
    ///
    /// <see cref="NeonAssets.VerticalGradientSprite"/>가 만드는 Texture2D/Sprite는 디스크에 없는
    /// 임시 오브젝트라, 프리팹을 구울 때 Image.sprite에 넣어도 null로 직렬화된다.
    /// (그러면 카드가 통짜 흰 사각형으로 나온다.) 색만 직렬화하고 스프라이트는 런타임에 만든다.
    /// </summary>
    [RequireComponent(typeof(Image))]
    public sealed class NeonGradientImage : MonoBehaviour
    {
        [SerializeField] private Color topColor = Color.white;
        [SerializeField] private Color bottomColor = Color.black;

        public void Configure(Color top, Color bottom)
        {
            topColor = top;
            bottomColor = bottom;
            Apply();
        }

        private void Awake() => Apply();

        private void Apply()
        {
            var image = GetComponent<Image>();
            if (image == null) return;
            image.sprite = NeonAssets.VerticalGradientSprite(topColor, bottomColor);
            image.type = Image.Type.Simple;
            image.color = Color.white;
        }
    }
}
