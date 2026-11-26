{
  description = "akronymisier.bar podcast website";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    # Provides zola 0.19.2, the version CI installs; newer releases reject config.toml
    nixpkgs-zola.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs =
    { nixpkgs, nixpkgs-zola, ... }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [
              nixpkgs-zola.legacyPackages.${system}.zola
              pkgs.deno
              # new-episode.ts reads the episode duration via ffprobe
              pkgs.ffmpeg
            ];
          };
        }
      );

      formatter = forAllSystems (system: nixpkgs.legacyPackages.${system}.nixfmt);
    };
}
