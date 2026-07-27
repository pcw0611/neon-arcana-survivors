#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace NeonArcana.Editor
{
    public static class PhaseThreePrefabBuilder
    {
        public const string PrefabRoot = "Assets/Resources/Prefabs";

        private static readonly string[] RequiredPrefabs =
        {
            "Player",
            "Enemy",
            "Projectile",
            "EnemyProjectile",
            "ExperienceGem",
            "CombatPulse",
            "MovePad",
            "WorldBackground",
            "GameHud"
        };

        [MenuItem("Neon Arcana/Phase 3/Rebuild Authored Prefabs")]
        public static void BuildAll()
        {
            EnsureFolder("Assets/Resources");
            EnsureFolder(PrefabRoot);

            Save("MovePad", VirtualJoystick.CreateTemplate());
            Save("Player", PlayerController.CreateTemplate());
            Save("Enemy", EnemyController.CreateTemplate());
            Save("Projectile", Projectile.CreateTemplate());
            Save("EnemyProjectile", EnemyProjectile.CreateTemplate());
            Save("ExperienceGem", ExperienceGem.CreateTemplate());
            Save("CombatPulse", CombatPulse.CreateTemplate());
            Save("WorldBackground", NeonGameBootstrap.CreateBackgroundTemplate());

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            Save("GameHud", GameHud.CreateTemplate());

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            ValidatePrefabs();
            Debug.Log($"NEON_ARCANA_PHASE3_PREFABS_OK count={RequiredPrefabs.Length}");
        }

        public static void ValidatePrefabs()
        {
            var missing = new List<string>();
            foreach (var name in RequiredPrefabs)
            {
                var path = $"{PrefabRoot}/{name}.prefab";
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (prefab == null)
                {
                    missing.Add(path);
                    continue;
                }
                if (GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(prefab) > 0)
                    throw new InvalidOperationException($"{path} contains a missing MonoBehaviour script.");
            }
            if (missing.Count > 0)
                throw new InvalidOperationException($"Missing Phase 3 prefabs: {string.Join(", ", missing)}");

            var hud = AssetDatabase.LoadAssetAtPath<GameObject>($"{PrefabRoot}/GameHud.prefab");
            if (hud.GetComponent<GameHud>() == null) throw new InvalidOperationException("GameHud prefab has no GameHud component.");
            foreach (var child in hud.GetComponentsInChildren<Transform>(true))
                if (child.name == "Aim Stick") throw new InvalidOperationException("The unauthorized right aim pad still exists.");
            if (hud.GetComponentsInChildren<VirtualJoystick>(true).Length != 1)
                throw new InvalidOperationException("GameHud must contain exactly one movement pad.");
            if (hud.transform.Find("Title Screen") == null) throw new InvalidOperationException("GameHud prefab has no title screen.");
        }

        private static void Save(string name, GameObject root)
        {
            try
            {
                root.name = name;
                root.SetActive(true);
                PrefabUtility.SaveAsPrefabAsset(root, $"{PrefabRoot}/{name}.prefab");
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(root);
            }
        }

        private static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var separator = path.LastIndexOf('/');
            if (separator <= 0) throw new InvalidOperationException($"Invalid asset folder path: {path}");
            var parent = path.Substring(0, separator);
            var child = path.Substring(separator + 1);
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, child);
        }
    }
}
#endif
