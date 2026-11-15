# Original Git history backup

This bundle preserves the complete original repository history through verified commit `9ee8c283d3f3d8f3cc79916993f1d4dcbfc22766`.
The working source in the repository root is imported byte-for-byte from that commit. The import commit has a different identity because this repository was initialized separately.

Reconstruct the bundle from this directory:

```sh
cat graybox-drive-verified.bundle.part* > graybox-drive-verified.bundle
shasum -a 256 graybox-drive-verified.bundle
# Expected: 2270bf6459f66f0b83d81ed0056e76f304861d9959c4539612bf31d3421e5836
git clone --branch main graybox-drive-verified.bundle recovered-graybox-drive
```

The numbered pieces avoid connector payload limits. The manifest lists their exact order and the reconstructed SHA-256. Additional current-run recordings and verification archives are saved in `../verified-run/`.
