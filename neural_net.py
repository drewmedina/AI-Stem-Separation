import torch.nn as nn

class UNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.middle = nn.Sequential(
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU()
        )
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(64, 32, 2, stride=2), nn.ReLU(),
            nn.ConvTranspose2d(
                32, 16, kernel_size=(2,2), stride=(2,2),
                output_padding=(1,0)   # ← this restores 512→513
            ), nn.ReLU(),
            nn.Conv2d(16, 1, 1), nn.Sigmoid()
        )

    def forward(self, x):
        x = self.encoder(x)
        x = self.middle(x)
        return self.decoder(x)
