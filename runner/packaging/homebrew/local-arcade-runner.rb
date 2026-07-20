# DRAFT — cannot be submitted until the first public runner-v* release exists.
# Cask reference: https://docs.brew.sh/Cask-Cookbook
cask "local-arcade-runner" do
  version "0.1.0" # TODO-release: match released tag
  sha256 "TODO-release" # from the release's signed checksums.txt

  url "TODO-release" # exact release-asset .dmg URL, never a `latest` redirect
  name "Local Arcade Runner"
  desc "Hardware-truth benchmarks for local AI models; nothing leaves the machine without explicit consent"
  homepage "TODO-release"

  app "Local Arcade Runner.app"
end
