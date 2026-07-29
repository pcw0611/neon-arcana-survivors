using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace NeonArcana.Editor
{
    /// <summary>
    /// TextMesh Pro 사용을 위한 1회성 셋업.
    /// TMP는 com.unity.ugui에 번들되어 있지만 Essential Resources를 임포트하지 않으면
    /// 기본 폰트 에셋이 없어 아무것도 렌더링되지 않는다.
    /// 또한 TMP 기본 폰트(LiberationSans)에는 한글 글리프가 없어 한국어가 전부 깨지므로,
    /// 맑은 고딕을 프로젝트에 복사해 한글용 폰트 소스로 함께 준비한다.
    /// </summary>
    public static class TextMeshProSetup
    {
        private const string FontDirectory = "Assets/Resources/Fonts";
        private const string KoreanFontPath = FontDirectory + "/NeonArcanaKorean.ttf";

        public static void ConfigureBatch()
        {
            ImportEssentialResources();
            ImportKoreanFontSource();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            // ImportPackage는 비동기라 같은 배치 실행 안에서 완료되지 않는다.
            // 임포트를 시작만 하고, 결과 검증은 다음 배치 실행(VerifyBatch)에서 한다.
            var koreanFont = AssetDatabase.LoadAssetAtPath<Font>(KoreanFontPath);
            Debug.Log($"NEON_ARCANA_TMP_IMPORT_STARTED koreanFont={(koreanFont != null ? koreanFont.name : "pending")}");
        }

        public static void VerifyBatch()
        {
            var settings = AssetDatabase.LoadAssetAtPath<UnityEngine.Object>("Assets/TextMesh Pro/Resources/TMP Settings.asset");
            var koreanFont = AssetDatabase.LoadAssetAtPath<Font>(KoreanFontPath);
            if (settings == null) throw new InvalidOperationException("TMP essential resources are still missing.");
            if (koreanFont == null) throw new InvalidOperationException("Korean font source is still missing.");
            Debug.Log($"NEON_ARCANA_TMP_SETUP_OK essentials=imported koreanFont={koreanFont.name}");
        }

        private static void ImportEssentialResources()
        {
            if (Directory.Exists("Assets/TextMesh Pro/Resources")) return;
            var packageRoot = Directory
                .GetDirectories("Library/PackageCache")
                .FirstOrDefault(path => Path.GetFileName(path).StartsWith("com.unity.ugui@", StringComparison.Ordinal));
            if (packageRoot == null) throw new InvalidOperationException("com.unity.ugui package was not found.");

            var essentials = Path.Combine(packageRoot, "Package Resources", "TMP Essential Resources.unitypackage");
            if (!File.Exists(essentials)) throw new InvalidOperationException($"TMP essentials package missing: {essentials}");
            AssetDatabase.ImportPackage(essentials, false);
        }

        private static void ImportKoreanFontSource()
        {
            if (File.Exists(KoreanFontPath)) return;
            if (!Directory.Exists(FontDirectory)) Directory.CreateDirectory(FontDirectory);
            var source = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Fonts", "malgun.ttf");
            if (!File.Exists(source)) throw new InvalidOperationException($"Korean system font missing: {source}");
            File.Copy(source, KoreanFontPath, false);
            AssetDatabase.ImportAsset(KoreanFontPath, ImportAssetOptions.ForceUpdate);
        }
    }
}
